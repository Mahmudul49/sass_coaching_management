/**
 * Import the "Ideal Learning Hub" monthly fee-collection sheet (Jan–Jul 2026).
 * Creates the tenant + admin + one class + 16 students, and one PAID payment
 * record per non-empty cell so the dashboard's monthly/yearly collection matches
 * the sheet exactly. Idempotent: wipes and recreates the "ideal-learning-hub"
 * tenant on each run. Superadmin/other tenants untouched.
 *
 * Run: npx tsx scripts/importIdeal.ts
 */
import "./loadEnv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const XLSX_PATH = "C:/Users/mahmu/Downloads/Four Monthly_Fee_Sheet_January_July.xlsx";
const YEAR = 2026;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July"]; // → month 1..7

/** "" / null → NaN (skip); "4000+2000" → 6000; numbers passthrough. */
function parseAmount(v: unknown): number {
  if (v === "" || v == null) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;
  const parts = s.split("+").map((x) => Number(x.trim()));
  if (parts.length && parts.every((x) => !isNaN(x))) return parts.reduce((a, b) => a + b, 0);
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const uri = process.env.MONGODB_URI!;
  const dbName = new URL(uri).pathname.replace(/^\//, "") || "coaching_center";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const slug = "ideal-learning-hub";
  const prev = await db.collection("tenants").findOne({ slug });
  if (prev) {
    const tid = prev._id.toString();
    for (const c of ["users", "classes", "sections", "feeStructure", "students", "attendance", "payments", "smsLog"]) {
      await db.collection(c).deleteMany({ tenantId: tid });
    }
    await db.collection("tenants").deleteOne({ _id: prev._id });
  }

  const tenantId = (
    await db.collection("tenants").insertOne({
      slug,
      name: "Ideal Learning Hub",
      adminName: "Ideal Learning Hub",
      adminPhone: "01800000000",
      active: true,
      attendanceSmsEnabled: false,
      createdAt: new Date(),
    })
  ).insertedId.toString();

  await db.collection("users").insertOne({
    tenantId,
    name: "Ideal Learning Hub",
    phone: "01800000000",
    passwordHash: await bcrypt.hash("ideal123", 10),
    role: "admin",
  });

  const classId = (await db.collection("classes").insertOne({ tenantId, name: "Four", order: 4 })).insertedId.toString();
  await db.collection("feeStructure").insertOne({
    tenantId,
    classId,
    admissionFee: 0,
    monthlyFee: 4000,
    modelTestHalfYearly: { amount: 0, month: 6, enabled: false },
    modelTestAnnual: { amount: 0, month: 12, enabled: false },
    others: [],
  });

  const monthTotals = Array(7).fill(0);
  let paymentsInserted = 0;
  let studentsInserted = 0;
  const skippedNames: string[] = [];

  let roll = 1;
  for (const r of rows) {
    const name = String(r["Student Name"] ?? "").trim();
    if (!name) continue;
    const studentId = (
      await db.collection("students").insertOne({
        tenantId,
        classId,
        sectionId: "",
        name,
        roll: String(roll),
        phone: "",
        active: true,
        createdAt: new Date(),
      })
    ).insertedId.toString();
    studentsInserted++;
    roll++;

    const pays: Record<string, unknown>[] = [];
    MONTHS.forEach((mName, idx) => {
      const amt = parseAmount(r[mName]);
      if (isNaN(amt) || amt <= 0) return; // blank or 0 → no collection recorded
      const month = idx + 1;
      monthTotals[idx] += amt;
      pays.push({
        tenantId,
        studentId,
        classId,
        year: YEAR,
        month,
        components: [{ type: "monthly", label: "মাসিক ফি", amount: amt }],
        totalAmount: amt,
        paidAmount: amt,
        status: "paid",
        paidAt: new Date(YEAR, month - 1, 5),
      });
    });
    if (pays.length) {
      await db.collection("payments").insertMany(pays);
      paymentsInserted += pays.length;
    } else {
      skippedNames.push(name);
    }
  }

  // Verify against the SAME aggregation the dashboard uses.
  const agg = await db
    .collection("payments")
    .aggregate<{ _id: number; paid: number }>([
      { $match: { tenantId, year: YEAR } },
      { $group: { _id: "$month", paid: { $sum: "$paidAmount" } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  const dash = Array(7).fill(0);
  for (const a of agg) if (a._id >= 1 && a._id <= 7) dash[a._id - 1] = a.paid;
  const yearCollection = dash.reduce((a, b) => a + b, 0);

  console.log("✅ Ideal Learning Hub imported");
  console.log(`   Students: ${studentsInserted}  |  Payment records: ${paymentsInserted}`);
  MONTHS.forEach((m, i) => console.log(`   ${m.padEnd(9)} — sheet:${monthTotals[i]}  dashboard:${dash[i]}  ${monthTotals[i] === dash[i] ? "✓" : "✗"}`));
  console.log(`   YEAR (2026) collection: ${yearCollection}`);
  console.log(`   July (current month) collection: ${dash[6]}`);
  if (skippedNames.length) console.log(`   (students with no payments: ${skippedNames.join(", ")})`);
  console.log("\n   Login:  /ideal-learning-hub/login   phone 01800000000 / password ideal123");
  await client.close();
}

main().catch((e) => {
  console.error("❌ import failed:", e);
  process.exit(1);
});
