import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import {
  Collections,
  type ClassDoc,
  type SectionDoc,
  type FeeStructureDoc,
  type StudentDoc,
  type PaymentDoc,
  type AttendanceDoc,
  type AttendanceStatus,
} from "@/lib/db/collections";

/** Plain (serialisable) row shapes handed to client components. */
export type ClassRow = { id: string; name: string; order: number };
export type SectionRow = { id: string; classId: string; className: string; name: string };
export type FeeRow = {
  id: string;
  classId: string;
  className: string;
  admissionFee: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number };
  modelTestAnnual: { amount: number; month: number };
  others: { label: string; amount: number }[];
};
export type StudentRow = {
  id: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  name: string;
  roll: string;
  phone: string;
  active: boolean;
};

export async function listClasses(db: ScopedDb): Promise<ClassRow[]> {
  const docs = (await db
    .collection<ClassDoc>(Collections.classes)
    .findArray({}, { sort: { order: 1, name: 1 } })) as ClassDoc[];
  return docs.map((c) => ({ id: c._id.toString(), name: c.name, order: c.order ?? 0 }));
}

export async function listSections(db: ScopedDb): Promise<SectionRow[]> {
  const [classes, docs] = await Promise.all([
    listClasses(db),
    db.collection<SectionDoc>(Collections.sections).findArray({}) as Promise<SectionDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  return docs
    .map((s) => ({
      id: s._id.toString(),
      classId: s.classId,
      className: classMap.get(s.classId) ?? "—",
      name: s.name,
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
}

export async function listFees(db: ScopedDb): Promise<FeeRow[]> {
  const [classes, docs] = await Promise.all([
    listClasses(db),
    db.collection<FeeStructureDoc>(Collections.feeStructure).findArray({}) as Promise<
      FeeStructureDoc[]
    >,
  ]);
  const feeByClass = new Map(docs.map((f) => [f.classId, f]));
  return classes.map((c) => {
    const f = feeByClass.get(c.id);
    return {
      id: f?._id.toString() ?? "",
      classId: c.id,
      className: c.name,
      admissionFee: f?.admissionFee ?? 0,
      monthlyFee: f?.monthlyFee ?? 0,
      modelTestHalfYearly: f?.modelTestHalfYearly ?? { amount: 0, month: 6 },
      modelTestAnnual: f?.modelTestAnnual ?? { amount: 0, month: 12 },
      others: f?.others ?? [],
    };
  });
}

export async function getFeeForClass(
  db: ScopedDb,
  classId: string
): Promise<FeeStructureDoc | null> {
  return (await db
    .collection<FeeStructureDoc>(Collections.feeStructure)
    .findOne({ classId })) as FeeStructureDoc | null;
}

export async function listStudents(
  db: ScopedDb,
  filter: { classId?: string; sectionId?: string } = {}
): Promise<StudentRow[]> {
  const [classes, sections] = await Promise.all([listClasses(db), listSections(db)]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (filter.sectionId) q.sectionId = filter.sectionId;

  const docs = (await db
    .collection<StudentDoc>(Collections.students)
    .findArray(q, { sort: { roll: 1 } })) as StudentDoc[];

  return docs.map((s) => ({
    id: s._id.toString(),
    classId: s.classId,
    sectionId: s.sectionId,
    className: classMap.get(s.classId) ?? "—",
    sectionName: sectionMap.get(s.sectionId) ?? "—",
    name: s.name,
    roll: s.roll,
    phone: s.phone,
    active: s.active !== false,
  }));
}

export type SetupStatus = {
  hasClasses: boolean;
  hasSections: boolean;
  hasFees: boolean;
  hasStudents: boolean;
  complete: boolean;
};

export async function getSetupStatus(db: ScopedDb): Promise<SetupStatus> {
  const [classes, sections, fees, students] = await Promise.all([
    db.collection(Collections.classes).countDocuments({}),
    db.collection(Collections.sections).countDocuments({}),
    db.collection(Collections.feeStructure).countDocuments({}),
    db.collection(Collections.students).countDocuments({}),
  ]);
  const hasClasses = classes > 0;
  const hasSections = sections > 0;
  const hasFees = fees > 0;
  const hasStudents = students > 0;
  return {
    hasClasses,
    hasSections,
    hasFees,
    hasStudents,
    complete: hasClasses && hasSections && hasFees && hasStudents,
  };
}

/** Map of studentId -> saved status for a class on a date. */
export async function getAttendanceMap(
  db: ScopedDb,
  classId: string,
  date: string
): Promise<Record<string, AttendanceStatus>> {
  const docs = (await db
    .collection<AttendanceDoc>(Collections.attendance)
    .findArray({ classId, date })) as AttendanceDoc[];
  const map: Record<string, AttendanceStatus> = {};
  for (const a of docs) map[a.studentId] = a.status;
  return map;
}

/* ───────────────────────── Payments ───────────────────────── */

export type PayColumn = { key: string; label: string; type: string };
export type PayStatus = "paid" | "partial" | "unpaid" | "none";
export type PayRow = {
  id: string; // studentId
  name: string;
  roll: string;
  sectionName: string;
  phone: string;
  amounts: Record<string, number>;
  paidAmount: number;
  status: PayStatus;
  saved: boolean;
};

/**
 * Build the payment grid for a class in a given month/year:
 *  - `template` = the columns (one per fee component that applies this month).
 *  - `rows` = one per student, amounts PRE-FILLED from the fee structure, or the
 *    saved payment values if a payment already exists.
 */
export async function buildPaymentRows(
  db: ScopedDb,
  classId: string,
  year: number,
  month: number
): Promise<{ template: PayColumn[]; rows: PayRow[] }> {
  const [fee, students, sections] = await Promise.all([
    getFeeForClass(db, classId),
    db.collection<StudentDoc>(Collections.students).findArray(
      { classId, active: true },
      { sort: { roll: 1 } }
    ) as Promise<StudentDoc[]>,
    listSections(db),
  ]);
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  const otherKey = (label: string) => `other:${label}`;

  // Column template from the fee structure (components that apply this month).
  const template: PayColumn[] = [];
  if (fee) {
    if (fee.admissionFee >= 0) template.push({ key: "admission", label: "ভর্তি ফি", type: "admission" });
    template.push({ key: "monthly", label: "মাসিক ফি", type: "monthly" });
    if (fee.modelTestHalfYearly?.amount > 0 && fee.modelTestHalfYearly.month === month)
      template.push({ key: "model_half", label: "ষান্মাসিক মডেল টেস্ট", type: "model_half" });
    if (fee.modelTestAnnual?.amount > 0 && fee.modelTestAnnual.month === month)
      template.push({ key: "model_annual", label: "বার্ষিক মডেল টেস্ট", type: "model_annual" });
    for (const o of fee.others ?? [])
      template.push({ key: otherKey(o.label), label: o.label, type: "other" });
  } else {
    template.push({ key: "monthly", label: "মাসিক ফি", type: "monthly" });
  }

  const defaults: Record<string, number> = {};
  if (fee) {
    defaults["admission"] = fee.admissionFee ?? 0;
    defaults["monthly"] = fee.monthlyFee ?? 0;
    defaults["model_half"] = fee.modelTestHalfYearly?.amount ?? 0;
    defaults["model_annual"] = fee.modelTestAnnual?.amount ?? 0;
    for (const o of fee.others ?? []) defaults[otherKey(o.label)] = o.amount ?? 0;
  }

  const payments = (await db
    .collection<PaymentDoc>(Collections.payments)
    .findArray({ classId, year, month })) as PaymentDoc[];
  const payByStudent = new Map(payments.map((p) => [p.studentId, p]));

  const rows: PayRow[] = students.map((s) => {
    const id = s._id.toString();
    const saved = payByStudent.get(id);
    const amounts: Record<string, number> = {};

    if (saved) {
      // Map saved components back onto template keys.
      for (const col of template) amounts[col.key] = 0;
      for (const c of saved.components) {
        const key = c.type === "other" ? otherKey(c.label) : c.type;
        amounts[key] = c.amount;
      }
      return {
        id,
        name: s.name,
        roll: s.roll,
        sectionName: sectionMap.get(s.sectionId) ?? "—",
        phone: s.phone,
        amounts,
        paidAmount: saved.paidAmount,
        status: saved.status,
        saved: true,
      };
    }

    // No saved payment: pre-fill fee amounts; paid defaults to 0 until entered manually.
    for (const col of template) {
      amounts[col.key] = defaults[col.key] ?? 0;
    }
    return {
      id,
      name: s.name,
      roll: s.roll,
      sectionName: sectionMap.get(s.sectionId) ?? "—",
      phone: s.phone,
      amounts,
      paidAmount: 0,
      status: "none",
      saved: false,
    };
  });

  return { template, rows };
}

/* ───────────────────────── Due report (§9) ───────────────────────── */

export type DueRow = {
  id: string;
  studentId: string;
  name: string;
  roll: string;
  className: string;
  sectionName: string;
  total: number;
  paid: number;
  due: number;
  status: "paid" | "partial" | "unpaid";
};

export async function getDueReport(
  db: ScopedDb,
  filter: { classId?: string; year: number; month: number; status?: string }
): Promise<DueRow[]> {
  const q: Record<string, unknown> = { year: filter.year, month: filter.month };
  if (filter.classId) q.classId = filter.classId;
  if (filter.status && ["paid", "partial", "unpaid"].includes(filter.status))
    q.status = filter.status;

  const [payments, classes, sections, students] = await Promise.all([
    db.collection<PaymentDoc>(Collections.payments).findArray(q) as Promise<PaymentDoc[]>,
    listClasses(db),
    listSections(db),
    db.collection<StudentDoc>(Collections.students).findArray({}) as Promise<StudentDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

  return payments
    .map((p) => {
      const s = studentMap.get(p.studentId);
      const due = Math.max(0, p.totalAmount - p.paidAmount);
      return {
        id: p._id.toString(),
        studentId: p.studentId,
        name: s?.name ?? "—",
        roll: s?.roll ?? "",
        className: classMap.get(p.classId) ?? "—",
        sectionName: s ? sectionMap.get(s.sectionId) ?? "—" : "—",
        total: p.totalAmount,
        paid: p.paidAmount,
        due,
        status: p.status,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className) || a.roll.localeCompare(b.roll));
}

export type DashboardStats = {
  activeStudents: number;
  collection: number;
  due: number;
};

export async function getDashboardStats(
  db: ScopedDb,
  year: number,
  month: number
): Promise<DashboardStats> {
  const [activeStudents, agg] = await Promise.all([
    db.collection(Collections.students).countDocuments({ active: true }),
    db
      .collection<PaymentDoc>(Collections.payments)
      .aggregate<{ paid: number; total: number }>([
        { $match: { year, month } },
        {
          $group: {
            _id: null,
            paid: { $sum: "$paidAmount" },
            total: { $sum: "$totalAmount" },
          },
        },
      ]),
  ]);
  const row = (await agg.toArray())[0];
  const collection = row?.paid ?? 0;
  const due = (row?.total ?? 0) - collection;
  return { activeStudents, collection, due: Math.max(0, due) };
}
