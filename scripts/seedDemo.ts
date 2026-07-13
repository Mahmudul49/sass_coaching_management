/**
 * DEMO ENVIRONMENT SEED — a fully functional, self-contained demo tenant so
 * clients can try every feature without touching production data.
 *
 * One command, fully idempotent (safe to re-run): it wipes the demo tenant and
 * all its data first, then recreates everything from scratch.
 *   npm run seed:demo        (alias: npm run demo:reset)
 *
 * Everything lives under a single tenant (slug "demo"), so it is completely
 * isolated from every other center by the app's normal tenant scoping. The demo
 * is clearly labelled "Demo" (tenant + admin name) and covers:
 *   profile · admin · classes · sections · subjects · fee structure ·
 *   students · attendance · payments (paid / due / partial / advance) ·
 *   fee overrides · exams (published + draft) · marks · results · transcript ·
 *   SMS logs (mock) · super↔admin message · reports.
 *
 * Login:  http://localhost:3000/demo/login   phone 01711111111   password demo123
 */
import "./loadEnv";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const SLUG = "demo";

// The academic "session" is the year; the demo spans May–Jul 2026 so the due
// report / matrix and monthly charts have a real range to show.
const YEAR = 2026;
const MONTHS = [5, 6, 7]; // May, June, July 2026

// Every tenant-scoped collection the demo touches. Used for the idempotent wipe.
const DEMO_COLLECTIONS = [
  "users",
  "classes",
  "sections",
  "subjects",
  "feeStructure",
  "feeOverride",
  "students",
  "attendance",
  "payments",
  "smsLog",
  "exams",
  "marks",
  "examSettings",
  "conversations",
  "messages",
];

// Demo content is fully English; student names are Bangladeshi (romanized).
const FIRST = [
  "Rahim", "Karim", "Salma", "Ayesha", "Tanvir", "Nusrat", "Sakib", "Mitu", "Rakib", "Fariya",
  "Hasan", "Jannat", "Imran", "Sumaiya", "Naeem", "Tasnim", "Riad", "Maria", "Shakil", "Lamia",
  "Arif", "Sadia", "Mehedi", "Rubina", "Zubayer", "Tania", "Asif", "Nila", "Rafi", "Oishi",
  "Sohan", "Munia", "Nafis", "Priya", "Rayhan", "Sejuti", "Tamim", "Bristy", "Sajib", "Mou",
];
const LAST = ["Uddin", "Sheikh", "Akter", "Hossain", "Islam", "Khan", "Chowdhury", "Rahman"];
const SUBJECTS = ["English", "Mathematics", "Science", "Social Studies", "Religious Studies"];

type FeeStructure = {
  admissionFee: number;
  admissionMonth: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number; enabled: boolean };
  modelTestAnnual: { amount: number; month: number; enabled: boolean };
  others: { label: string; amount: number }[];
};

/** Fee components payable for a class in a given month (mirrors the app's rules). */
function payableComponents(fee: FeeStructure, month: number) {
  const comps: { type: string; label: string; amount: number }[] = [];
  if (fee.admissionFee > 0 && fee.admissionMonth === month)
    comps.push({ type: "admission", label: "Admission Fee", amount: fee.admissionFee });
  comps.push({ type: "monthly", label: "Monthly Fee", amount: fee.monthlyFee });
  if (fee.modelTestHalfYearly.enabled && fee.modelTestHalfYearly.month === month)
    comps.push({ type: "model_half", label: "Half-Yearly Model Test", amount: fee.modelTestHalfYearly.amount });
  if (fee.modelTestAnnual.enabled && fee.modelTestAnnual.month === month)
    comps.push({ type: "model_annual", label: "Annual Model Test", amount: fee.modelTestAnnual.amount });
  for (const o of fee.others) comps.push({ type: "other", label: o.label, amount: o.amount }); // month undefined = every month
  return comps;
}

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = new URL(uri).pathname.replace(/^\//, "") || "coaching_center";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // ── Idempotent reset: remove any previous demo tenant + all its data. ──────
  const existing = await db.collection("tenants").findOne({ slug: SLUG });
  if (existing) {
    const tid = existing._id.toString();
    await db.collection("tenants").deleteOne({ slug: SLUG });
    for (const c of DEMO_COLLECTIONS) await db.collection(c).deleteMany({ tenantId: tid });
  }

  // ── Profile (clearly labelled "Demo") ─────────────────────────────────────
  const tenantRes = await db.collection("tenants").insertOne({
    slug: SLUG,
    name: "Demo School & Coaching Center",
    adminName: "Demo Admin",
    adminPhone: "01711111111",
    active: true,
    attendanceSmsEnabled: true, // demo shows the attendance-SMS path (logged, not sent)
    createdAt: new Date(),
  });
  const tenantId = tenantRes.insertedId.toString();

  // ── Admin ─────────────────────────────────────────────────────────────────
  await db.collection("users").insertOne({
    tenantId,
    name: "Demo Admin",
    phone: "01711111111",
    passwordHash: await bcrypt.hash("demo123", 10),
    role: "admin",
  });

  // ── Classes, sections, subjects, fee structures ───────────────────────────
  const classDefs = [
    { name: "Class 6", order: 6, monthly: 800, admission: 500, half: 300, annual: 500, others: [{ label: "Exam Fee", amount: 100 }] },
    { name: "Class 7", order: 7, monthly: 1000, admission: 600, half: 350, annual: 600, others: [] as { label: string; amount: number }[] },
    { name: "Class 8", order: 8, monthly: 1200, admission: 700, half: 400, annual: 700, others: [{ label: "Library Fee", amount: 50 }] },
  ];

  type ClassInfo = { id: string; name: string; sections: { id: string; name: string }[]; subjectIds: string[]; fee: FeeStructure };
  const classes: ClassInfo[] = [];

  for (const cd of classDefs) {
    const cid = (await db.collection("classes").insertOne({ tenantId, name: cd.name, order: cd.order })).insertedId.toString();
    const sections: { id: string; name: string }[] = [];
    for (const sn of ["A", "B"]) {
      const sid = (await db.collection("sections").insertOne({ tenantId, classId: cid, name: sn })).insertedId.toString();
      sections.push({ id: sid, name: sn });
    }
    const subjectIds: string[] = [];
    for (let i = 0; i < SUBJECTS.length; i++) {
      const subId = (await db.collection("subjects").insertOne({ tenantId, classId: cid, name: SUBJECTS[i], order: i + 1 })).insertedId.toString();
      subjectIds.push(subId);
    }
    const fee: FeeStructure = {
      admissionFee: cd.admission,
      admissionMonth: 1,
      monthlyFee: cd.monthly,
      modelTestHalfYearly: { amount: cd.half, month: 6, enabled: true },
      modelTestAnnual: { amount: cd.annual, month: 12, enabled: true },
      others: cd.others,
    };
    await db.collection("feeStructure").insertOne({ tenantId, classId: cid, ...fee });
    classes.push({ id: cid, name: cd.name, sections, subjectIds, fee });
  }

  // ── Results settings (Demo transcript title) ──────────────────────────────
  await db.collection("examSettings").insertOne({
    tenantId,
    scope: "exam",
    gradingScale: [
      { grade: "A+", minPct: 80, point: 5 },
      { grade: "A", minPct: 70, point: 4 },
      { grade: "A-", minPct: 60, point: 3.5 },
      { grade: "B", minPct: 50, point: 3 },
      { grade: "C", minPct: 40, point: 2 },
      { grade: "D", minPct: 33, point: 1 },
      { grade: "F", minPct: 0, point: 0 },
    ],
    passRule: "per_subject",
    defaultTotalMarks: 100,
    defaultPassMarks: 33,
    examTypes: ["Class Test", "Weekly Test", "Monthly Test", "Model Test", "Half Yearly", "Annual"],
    certificateTitle: "Demo Academic Transcript",
    notifyOnPublish: true,
    updatedAt: new Date(),
  });

  // ── Students (complete data for lists, ID cards, reports) ──────────────────
  type Stu = { id: string; classId: string; className: string; sectionId: string; name: string; roll: string; phone: string };
  const students: Stu[] = [];
  const studentDocs: Record<string, unknown>[] = [];
  let n = 0;
  const perSectionCount = 8; // 3 classes × 2 sections × 8 = 48 students
  for (const c of classes) {
    let roll = 1;
    for (const sec of c.sections) {
      for (let i = 0; i < perSectionCount; i++) {
        const name = `${FIRST[n % FIRST.length]} ${LAST[n % LAST.length]}`;
        const phone = `0171${String(2000000 + n).slice(-7)}`;
        studentDocs.push({ tenantId, classId: c.id, sectionId: sec.id, name, roll: String(roll), phone, active: true, createdAt: new Date() });
        students.push({ id: "", classId: c.id, className: c.name, sectionId: sec.id, name, roll: String(roll), phone });
        roll++;
        n++;
      }
    }
  }
  const insStudents = await db.collection("students").insertMany(studentDocs as never[]);
  Object.values(insStudents.insertedIds).forEach((oid, i) => (students[i].id = oid.toString()));

  const classById = new Map(classes.map((c) => [c.id, c]));

  // ── Payments: paid / partial / due / advance across May–Jul 2026 ──────────
  const payments: Record<string, unknown>[] = [];
  students.forEach((s, idx) => {
    const fee = classById.get(s.classId)!.fee;
    const profile = idx % 6; // deterministic mix of behaviours
    for (const month of MONTHS) {
      const comps = payableComponents(fee, month);
      const total = comps.reduce((a, c) => a + c.amount, 0);
      const isJuly = month === 7;

      // Decide this month's paid amount + whether a record exists.
      let paidAmount: number | null = total; // default: full
      if (profile === 2 && isJuly) paidAmount = Math.round(total / 2); // partial in July
      else if (profile === 3 && isJuly) paidAmount = null; // due in July (no record)
      else if (profile === 4 && isJuly) paidAmount = total * 2; // ADVANCE in July (overpay)
      else if (profile === 5 && month >= 6) paidAmount = null; // chronic arrears (Jun & Jul due)

      if (paidAmount === null) continue; // no payment record => shows as due
      const status = paidAmount >= total ? "paid" : "partial";
      payments.push({
        tenantId,
        studentId: s.id,
        classId: s.classId,
        year: YEAR,
        month,
        components: comps,
        totalAmount: total,
        paidAmount,
        status,
        paidAt: new Date(YEAR, month - 1, 5),
        remarks: profile === 4 && isJuly ? "Advance payment (demo)" : "",
      });
    }
  });
  await db.collection("payments").insertMany(payments as never[]);

  // ── Fee override: demonstrate a custom payable + a "Not Enrolled" month ────
  const overrideStudent = students[0];
  await db.collection("feeOverride").insertMany([
    { tenantId, studentId: overrideStudent.id, year: YEAR, month: 7, payable: 500, updatedAt: new Date() }, // discounted July
    { tenantId, studentId: students[1].id, year: YEAR, month: 6, payable: 0, updatedAt: new Date() }, // Not Enrolled in June
  ] as never[]);

  // ── Attendance across several July dates (per class) ──────────────────────
  const dates = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"];
  const attendance: Record<string, unknown>[] = [];
  for (const date of dates) {
    students.forEach((s, i) => {
      const present = (i + date.charCodeAt(9)) % 6 !== 0; // deterministic ~83% present
      attendance.push({ tenantId, classId: s.classId, date, studentId: s.id, status: present ? "present" : "absent" });
    });
  }
  await db.collection("attendance").insertMany(attendance as never[]);

  // ── Exams + marks (2 published for results/transcript, 1 draft = pending) ──
  const c6 = classes[0];
  const c7 = classes[1];
  const c8 = classes[2];

  const examA = await db.collection("exams").insertOne({
    tenantId, classId: c6.id, name: "Half Yearly Examination", examType: "Half Yearly",
    date: "2026-06-20", totalMarks: 100, passMarks: 33, subjectIds: c6.subjectIds,
    status: "published", createdAt: new Date("2026-06-01"), publishedAt: new Date("2026-06-25"),
  });
  const examB = await db.collection("exams").insertOne({
    tenantId, classId: c7.id, name: "Monthly Test — July", examType: "Monthly Test",
    date: "2026-07-05", totalMarks: 50, passMarks: 17, subjectIds: c7.subjectIds,
    status: "published", createdAt: new Date("2026-07-01"), publishedAt: new Date("2026-07-08"),
  });
  // Draft exam (Class 8) — intentionally left with no marks so it appears as
  // "pending marks" on the results dashboard; its id isn't needed afterwards.
  await db.collection("exams").insertOne({
    tenantId, classId: c8.id, name: "Model Test", examType: "Model Test",
    date: "2026-07-12", totalMarks: 100, passMarks: 33, subjectIds: c8.subjectIds,
    status: "draft", createdAt: new Date("2026-07-10"), publishedAt: null,
  });

  // Deterministic mark generator: mostly passing, a few low, for grade spread.
  const markFor = (studentIdx: number, subjIdx: number, outOf: number) => {
    const pct = 30 + ((studentIdx * 7 + subjIdx * 13) % 71); // 30..100
    return Math.min(outOf, Math.round((pct / 100) * outOf));
  };

  const marks: Record<string, unknown>[] = [];
  const seedMarks = (examId: string, cls: ClassInfo, outOf: number) => {
    const roster = students.filter((s) => s.classId === cls.id);
    roster.forEach((s, i) => {
      const entries = cls.subjectIds.map((subId, j) => ({ subjectId: subId, obtained: markFor(i, j, outOf) }));
      marks.push({ tenantId, examId, studentId: s.id, classId: cls.id, entries, updatedAt: new Date() });
    });
  };
  seedMarks(examA.insertedId.toString(), c6, 100);
  seedMarks(examB.insertedId.toString(), c7, 50);
  // examC (draft) left with no marks → shows as "pending marks" on the results dashboard.

  await db.collection("marks").insertMany(marks as never[]);

  // ── SMS logs (mock — the app logs at $0 without sending) ───────────────────
  const now = new Date();
  const smsLog: Record<string, unknown>[] = [];
  const someStudents = students.slice(0, 6);
  someStudents.forEach((s, i) => {
    const kind = ["payment_received", "payment_due", "attendance_absent", "result_published"][i % 4];
    const body =
      kind === "payment_received" ? `Dear guardian, ${s.name}'s fee has been received. Thank you.`
      : kind === "payment_due" ? `Dear guardian, ${s.name}'s fee is due. Please pay soon.`
      : kind === "attendance_absent" ? `Dear guardian, ${s.name} was absent today.`
      : `Dear guardian, ${s.name}'s exam result has been published.`;
    smsLog.push({ tenantId, studentId: s.id, phone: s.phone, body, kind, sentAt: new Date(now.getTime() - i * 3600_000), ok: true });
  });
  await db.collection("smsLog").insertMany(smsLog as never[]);

  // ── A welcome message from the Super Admin (Messages inbox) ────────────────
  const convId = new ObjectId();
  const msgAt = new Date(now.getTime() - 86_400_000);
  await db.collection("conversations").insertOne({
    _id: convId,
    tenantId,
    lastMessageAt: msgAt,
    lastMessagePreview: "Welcome to the demo! Explore every feature freely.",
    lastSenderRole: "superadmin",
    adminUnread: 1,
    superUnread: 0,
    createdAt: msgAt,
  });
  await db.collection("messages").insertOne({
    tenantId,
    conversationId: convId.toString(),
    senderRole: "superadmin",
    senderId: "system",
    senderName: "Super Admin",
    body: "Welcome to the demo! Explore every feature freely — this is sample data and safe to change.",
    createdAt: msgAt,
    readByAdmin: false,
    readBySuper: true,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  });

  console.log("✅ Demo environment ready (fully reseeded)");
  console.log(`   Classes: ${classes.length}  Students: ${students.length}  Payments: ${payments.length}  Attendance: ${attendance.length}  Marks: ${marks.length}  SMS: ${smsLog.length}`);
  console.log("   Login URL:  http://localhost:3000/demo/login");
  console.log("   Phone:      01711111111");
  console.log("   Password:   demo123");
  await client.close();
}

main().catch((e) => {
  console.error("❌ seedDemo failed:", e);
  process.exit(1);
});
