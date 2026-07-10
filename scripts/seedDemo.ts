/**
 * Seed a demo tenant with sample data for local testing.
 * Run: npx tsx scripts/seedDemo.ts
 *
 * Creates tenant slug "demo" (admin phone 01711111111 / password demo123) with
 * 2 classes, sections, fee structures, ~40 students, current-month payments and
 * attendance across the report range — enough to exercise the search, payments
 * cards and both reports. Idempotent: it wipes and recreates the demo data.
 */
import "./loadEnv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const FIRST = [
  "রহিম", "করিম", "সালমা", "আয়েশা", "তানভীর", "নুসরাত", "সাকিব", "মিতু", "রাকিব", "ফারিয়া",
  "হাসান", "জান্নাত", "ইমরান", "সুমাইয়া", "নাঈম", "তাসনিম", "রিয়াদ", "মারিয়া", "শাকিল", "লামিয়া",
  "আরিফ", "সাদিয়া", "মেহেদী", "রুবিনা", "জুবায়ের", "তানিয়া", "আসিফ", "নীলা", "রাফি", "ঐশী",
  "সোহান", "মুন", "নাফিস", "প্রিয়া", "রায়হান", "সেঁজুতি", "তামিম", "বৃষ্টি", "সজীব", "মৌ",
];
const LAST = ["উদ্দিন", "শেখ", "আক্তার", "হোসেন", "ইসলাম", "খান", "চৌধুরী", "রহমান"];

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = new URL(uri).pathname.replace(/^\//, "") || "coaching_center";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const slug = "demo";
  // Clean any previous demo tenant + its data.
  const existing = await db.collection("tenants").findOne({ slug });
  if (existing) {
    const tid = existing._id.toString();
    await Promise.all([
      db.collection("tenants").deleteOne({ slug }),
      db.collection("users").deleteMany({ tenantId: tid }),
      db.collection("classes").deleteMany({ tenantId: tid }),
      db.collection("sections").deleteMany({ tenantId: tid }),
      db.collection("feeStructure").deleteMany({ tenantId: tid }),
      db.collection("students").deleteMany({ tenantId: tid }),
      db.collection("attendance").deleteMany({ tenantId: tid }),
      db.collection("payments").deleteMany({ tenantId: tid }),
    ]);
  }

  const tenantRes = await db.collection("tenants").insertOne({
    slug,
    name: "ডেমো কোচিং সেন্টার",
    adminName: "ডেমো অ্যাডমিন",
    adminPhone: "01711111111",
    active: true,
    attendanceSmsEnabled: false,
    createdAt: new Date(),
  });
  const tenantId = tenantRes.insertedId.toString();

  await db.collection("users").insertOne({
    tenantId,
    name: "ডেমো অ্যাডমিন",
    phone: "01711111111",
    passwordHash: await bcrypt.hash("demo123", 10),
    role: "admin",
  });

  const c6 = await db.collection("classes").insertOne({ tenantId, name: "Class 6", order: 6 });
  const c7 = await db.collection("classes").insertOne({ tenantId, name: "Class 7", order: 7 });
  const c6Id = c6.insertedId.toString();
  const c7Id = c7.insertedId.toString();

  const s6a = (await db.collection("sections").insertOne({ tenantId, classId: c6Id, name: "A" })).insertedId.toString();
  const s6b = (await db.collection("sections").insertOne({ tenantId, classId: c6Id, name: "B" })).insertedId.toString();
  const s7a = (await db.collection("sections").insertOne({ tenantId, classId: c7Id, name: "A" })).insertedId.toString();

  await db.collection("feeStructure").insertMany([
    {
      tenantId,
      classId: c6Id,
      admissionFee: 500,
      admissionMonth: 1,
      monthlyFee: 800,
      modelTestHalfYearly: { amount: 300, month: 6 },
      modelTestAnnual: { amount: 500, month: 12 },
      others: [{ label: "পরীক্ষা ফি", amount: 100 }],
    },
    {
      tenantId,
      classId: c7Id,
      admissionFee: 600,
      admissionMonth: 1,
      monthlyFee: 1000,
      modelTestHalfYearly: { amount: 350, month: 6 },
      modelTestAnnual: { amount: 600, month: 12 },
      others: [],
    },
  ]);

  // ~40 students across the two classes / three sections.
  type Stu = { _id: string; classId: string; monthly: number };
  const students: Stu[] = [];
  const docs: Record<string, unknown>[] = [];
  let n = 0;
  const make = (classId: string, sectionId: string, monthly: number, rollBase: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const name = `${FIRST[n % FIRST.length]} ${LAST[n % LAST.length]}`;
      const _id = { toString: () => "" }; // placeholder; real _id assigned after insert
      docs.push({
        _tmp: n,
        tenantId,
        classId,
        sectionId,
        name,
        roll: String(rollBase + i),
        phone: `0171${String(1000000 + n).slice(-7)}`,
        active: true,
        createdAt: new Date(),
      });
      students.push({ _id: "", classId, monthly });
      n++;
      void _id;
    }
  };
  make(c6Id, s6a, 800, 101, 15);
  make(c6Id, s6b, 800, 151, 9);
  make(c7Id, s7a, 1000, 201, 16);

  const ins = await db.collection("students").insertMany(docs as never[]);
  // Map inserted ids back to our student list (insertMany preserves order).
  Object.values(ins.insertedIds).forEach((oid, i) => {
    students[i]._id = oid.toString();
  });

  // Current-month (July 2026) payments for ~60% of students: mix of full/partial.
  const year = 2026;
  const month = 7;
  const payments: Record<string, unknown>[] = [];
  students.forEach((s, i) => {
    if (i % 5 === 0) return; // ~20% left completely unpaid
    const total = s.monthly + (s.classId === c6Id ? 100 : 0); // + exam fee for c6
    const full = i % 3 !== 0; // ~2/3 full, ~1/3 partial
    const paidAmount = full ? total : Math.round(total / 2);
    payments.push({
      tenantId,
      studentId: s._id,
      classId: s.classId,
      year,
      month,
      components:
        s.classId === c6Id
          ? [
              { type: "monthly", label: "মাসিক ফি", amount: s.monthly },
              { type: "other", label: "পরীক্ষা ফি", amount: 100 },
            ]
          : [{ type: "monthly", label: "মাসিক ফি", amount: s.monthly }],
      totalAmount: total,
      paidAmount,
      status: full ? "paid" : "partial",
      paidAt: new Date(year, month - 1, 5),
    });
  });
  if (payments.length) await db.collection("payments").insertMany(payments as never[]);

  // Attendance for Class 6 across several July dates (inside the report range).
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07", "2026-07-08"];
  const attendance: Record<string, unknown>[] = [];
  const c6students = students.filter((s) => s.classId === c6Id);
  for (const date of dates) {
    c6students.forEach((s, i) => {
      // deterministic ~80% present
      const present = (i + date.charCodeAt(9)) % 5 !== 0;
      attendance.push({
        tenantId,
        classId: c6Id,
        date,
        studentId: s._id,
        status: present ? "present" : "absent",
      });
    });
  }
  await db.collection("attendance").insertMany(attendance as never[]);

  console.log("✅ Demo tenant ready");
  console.log(`   Students:   ${students.length}  |  Payments: ${payments.length}  |  Attendance: ${attendance.length}`);
  console.log("   Login URL:  http://localhost:3000/demo/login");
  console.log("   Phone:      01711111111");
  console.log("   Password:   demo123");
  await client.close();
}

main().catch((e) => {
  console.error("❌ seedDemo failed:", e);
  process.exit(1);
});
