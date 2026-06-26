/**
 * Seed a demo tenant with sample data for local testing.
 * Run: npx tsx scripts/seedDemo.ts
 *
 * Creates tenant slug "demo" (admin phone 01711111111 / password demo123) with
 * 2 classes, sections, fee structures and a few students. Idempotent-ish: it
 * wipes and recreates the demo tenant's data each run.
 */
import "./loadEnv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

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

  const s6a = await db.collection("sections").insertOne({ tenantId, classId: c6Id, name: "A" });
  await db.collection("sections").insertOne({ tenantId, classId: c6Id, name: "B" });
  const s7a = await db.collection("sections").insertOne({ tenantId, classId: c7Id, name: "A" });

  await db.collection("feeStructure").insertMany([
    {
      tenantId,
      classId: c6Id,
      admissionFee: 500,
      monthlyFee: 800,
      modelTestHalfYearly: { amount: 300, month: 6 },
      modelTestAnnual: { amount: 500, month: 12 },
      others: [{ label: "পরীক্ষা ফি", amount: 100 }],
    },
    {
      tenantId,
      classId: c7Id,
      admissionFee: 600,
      monthlyFee: 1000,
      modelTestHalfYearly: { amount: 350, month: 6 },
      modelTestAnnual: { amount: 600, month: 12 },
      others: [],
    },
  ]);

  await db.collection("students").insertMany([
    { tenantId, classId: c6Id, sectionId: s6a.insertedId.toString(), name: "রহিম উদ্দিন", roll: "101", phone: "01710000001", active: true, createdAt: new Date() },
    { tenantId, classId: c6Id, sectionId: s6a.insertedId.toString(), name: "করিম শেখ", roll: "102", phone: "01710000002", active: true, createdAt: new Date() },
    { tenantId, classId: c7Id, sectionId: s7a.insertedId.toString(), name: "সালমা আক্তার", roll: "201", phone: "01710000003", active: true, createdAt: new Date() },
  ]);

  console.log("✅ Demo tenant ready");
  console.log("   URL:      http://demo.localhost:3000");
  console.log("   Phone:    01711111111");
  console.log("   Password: demo123");
  await client.close();
}

main().catch((e) => {
  console.error("❌ seedDemo failed:", e);
  process.exit(1);
});
