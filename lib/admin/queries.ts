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
import { monthName, toBnDigits } from "@/lib/format";

/** Plain (serialisable) row shapes handed to client components. */
export type ClassRow = { id: string; name: string; order: number };
export type SectionRow = { id: string; classId: string; className: string; name: string };
export type FeeRow = {
  id: string;
  classId: string;
  className: string;
  admissionFee: number;
  admissionMonth: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number; enabled: boolean };
  modelTestAnnual: { amount: number; month: number; enabled: boolean };
  others: { label: string; amount: number; month: number }[];
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
      admissionMonth: f?.admissionMonth ?? 1,
      monthlyFee: f?.monthlyFee ?? 0,
      modelTestHalfYearly: {
        amount: f?.modelTestHalfYearly?.amount ?? 0,
        month: f?.modelTestHalfYearly?.month ?? 6,
        enabled: f?.modelTestHalfYearly?.enabled !== false,
      },
      modelTestAnnual: {
        amount: f?.modelTestAnnual?.amount ?? 0,
        month: f?.modelTestAnnual?.month ?? 12,
        enabled: f?.modelTestAnnual?.enabled !== false,
      },
      others: (f?.others ?? []).map((o) => ({
        label: o.label,
        amount: o.amount,
        month: o.month ?? 1,
      })),
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
  filter: { classId?: string; sectionId?: string; activeOnly?: boolean } = {}
): Promise<StudentRow[]> {
  const [classes, sections] = await Promise.all([listClasses(db), listSections(db)]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (filter.sectionId) q.sectionId = filter.sectionId;
  if (filter.activeOnly) q.active = true; // hide inactive from operational modules

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

/* ─────────────────── Attendance report (range) ─────────────────── */

export type AttendanceReportRow = {
  id: string; // studentId
  name: string;
  roll: string;
  sectionName: string;
  present: number;
  absent: number;
  total: number;
  pct: number; // present / total * 100
};

/**
 * Per-student attendance summary for a class over a date range: present/absent
 * counts + percentage. Only active students; date compared as YYYY-MM-DD string.
 */
export async function getAttendanceReport(
  db: ScopedDb,
  filter: { classId: string; from: string; to: string }
): Promise<{ rows: AttendanceReportRow[]; days: number }> {
  if (!filter.classId) return { rows: [], days: 0 };
  const [from, to] = filter.from <= filter.to ? [filter.from, filter.to] : [filter.to, filter.from];

  const [students, docs] = await Promise.all([
    listStudents(db, { classId: filter.classId, activeOnly: true }),
    db
      .collection<AttendanceDoc>(Collections.attendance)
      .findArray({ classId: filter.classId, date: { $gte: from, $lte: to } }) as Promise<AttendanceDoc[]>,
  ]);

  const byStudent = new Map<string, { present: number; absent: number }>();
  const dates = new Set<string>();
  for (const a of docs) {
    dates.add(a.date);
    const cur = byStudent.get(a.studentId) ?? { present: 0, absent: 0 };
    if (a.status === "absent") cur.absent += 1;
    else cur.present += 1;
    byStudent.set(a.studentId, cur);
  }

  const rows: AttendanceReportRow[] = students.map((s) => {
    const c = byStudent.get(s.id) ?? { present: 0, absent: 0 };
    const total = c.present + c.absent;
    return {
      id: s.id,
      name: s.name,
      roll: s.roll,
      sectionName: s.sectionName,
      present: c.present,
      absent: c.absent,
      total,
      pct: total > 0 ? Math.round((c.present / total) * 100) : 0,
    };
  });

  return { rows, days: dates.size };
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
  remarks: string;
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

  // A month-bound fee applies when its month matches (undefined month = legacy,
  // meaning every month).
  const applies = (m?: number) => m === undefined || m === month;

  // Column template from the fee structure (components that apply this month).
  const template: PayColumn[] = [];
  if (fee) {
    if (fee.admissionFee > 0 && applies(fee.admissionMonth))
      template.push({ key: "admission", label: "ভর্তি ফি", type: "admission" });
    template.push({ key: "monthly", label: "মাসিক ফি", type: "monthly" });
    if (
      fee.modelTestHalfYearly?.enabled !== false &&
      fee.modelTestHalfYearly?.amount > 0 &&
      fee.modelTestHalfYearly.month === month
    )
      template.push({ key: "model_half", label: "ষান্মাসিক মডেল টেস্ট", type: "model_half" });
    if (
      fee.modelTestAnnual?.enabled !== false &&
      fee.modelTestAnnual?.amount > 0 &&
      fee.modelTestAnnual.month === month
    )
      template.push({ key: "model_annual", label: "বার্ষিক মডেল টেস্ট", type: "model_annual" });
    for (const o of fee.others ?? [])
      if (applies(o.month))
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
        remarks: saved.remarks ?? "",
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
      remarks: "",
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
  phone: string;
  className: string;
  sectionName: string;
  year: number;
  month: number;
  period: string; // e.g. "জুলাই ২০২৬"
  components: { label: string; amount: number }[];
  total: number;
  paid: number;
  due: number;
  status: "paid" | "partial" | "unpaid";
};

/** Convert a YYYY-MM-DD string to a year*100+month key; null if unparseable. */
function ymKeyFromDate(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2]);
}

/** Enumerate every {year, month} from ym key `lo` to `hi` inclusive. */
function monthsInRange(lo: number, hi: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = Math.floor(lo / 100);
  let m = lo % 100;
  if (m < 1 || m > 12) return out;
  while (y * 100 + m <= hi && out.length < 240) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Fee-structure-driven due report. For every month in the From–To range and
 * every active student, it computes the expected fee from the class's fee
 * structure (monthly + model tests that fall in that month + other recurring
 * fees; admission is a one-time fee and excluded from the monthly projection),
 * overlays the actual payment record if one exists, and derives the status.
 * So a student who never paid still shows up as বাকি (unpaid) with the full
 * expected amount due. Filtered by class and status.
 */
export async function getDueReport(
  db: ScopedDb,
  filter: { classId?: string; from: string; to: string; status?: string }
): Promise<DueRow[]> {
  const fromYM = ymKeyFromDate(filter.from) ?? 0;
  const toYM = ymKeyFromDate(filter.to) ?? 999912;
  const [lo, hi] = fromYM <= toYM ? [fromYM, toYM] : [toYM, fromYM];
  const months = monthsInRange(lo, hi);
  const statusFilter =
    filter.status && ["paid", "partial", "unpaid"].includes(filter.status)
      ? filter.status
      : "";

  // Load ALL students (active + inactive) in the class: inactive students keep
  // their payment history in reports, but only active students get projected
  // (unpaid) dues for months without a payment record.
  const studentQuery: Record<string, unknown> = {};
  if (filter.classId) studentQuery.classId = filter.classId;

  const paymentQuery: Record<string, unknown> = {
    $expr: {
      $and: [
        { $gte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, lo] },
        { $lte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, hi] },
      ],
    },
  };
  if (filter.classId) paymentQuery.classId = filter.classId;

  const [classes, sections, students, fees, payments] = await Promise.all([
    listClasses(db),
    listSections(db),
    db.collection<StudentDoc>(Collections.students).findArray(studentQuery) as Promise<StudentDoc[]>,
    db.collection<FeeStructureDoc>(Collections.feeStructure).findArray({}) as Promise<FeeStructureDoc[]>,
    db.collection<PaymentDoc>(Collections.payments).findArray(paymentQuery) as Promise<PaymentDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const feeByClass = new Map(fees.map((f) => [f.classId, f]));
  const payKey = (studentId: string, year: number, month: number) => `${studentId}:${year}:${month}`;
  const payMap = new Map(payments.map((p) => [payKey(p.studentId, p.year, p.month), p]));

  // Expected fee components for a class in a given month. Each month-bound fee
  // (admission, model tests, others) applies only in its configured month;
  // undefined month = legacy "every month".
  function expectedComponents(fee: FeeStructureDoc | undefined, month: number) {
    const comps: { label: string; amount: number }[] = [];
    if (!fee) return comps;
    const applies = (m?: number) => m === undefined || m === month;
    if (fee.admissionFee > 0 && applies(fee.admissionMonth))
      comps.push({ label: "ভর্তি ফি", amount: fee.admissionFee });
    if (fee.monthlyFee > 0) comps.push({ label: "মাসিক ফি", amount: fee.monthlyFee });
    if (
      fee.modelTestHalfYearly?.enabled !== false &&
      fee.modelTestHalfYearly?.amount > 0 &&
      fee.modelTestHalfYearly.month === month
    )
      comps.push({ label: "ষান্মাসিক মডেল টেস্ট", amount: fee.modelTestHalfYearly.amount });
    if (
      fee.modelTestAnnual?.enabled !== false &&
      fee.modelTestAnnual?.amount > 0 &&
      fee.modelTestAnnual.month === month
    )
      comps.push({ label: "বার্ষিক মডেল টেস্ট", amount: fee.modelTestAnnual.amount });
    for (const o of fee.others ?? [])
      if (o.amount > 0 && applies(o.month)) comps.push({ label: o.label, amount: o.amount });
    return comps;
  }

  const rows: DueRow[] = [];
  for (const s of students) {
    const sid = s._id.toString();
    const fee = feeByClass.get(s.classId);
    for (const { year, month } of months) {
      const paid = payMap.get(payKey(sid, year, month));

      let total: number;
      let paidAmount: number;
      let components: { label: string; amount: number }[];
      let status: "paid" | "partial" | "unpaid";

      if (paid) {
        // A real payment record exists — use the actual billed/paid values.
        total = paid.totalAmount;
        paidAmount = paid.paidAmount;
        components = (paid.components ?? []).map((c) => ({ label: c.label, amount: c.amount }));
        status = paid.status;
      } else {
        // No payment record. Only project expected dues for ACTIVE students;
        // inactive students appear only via their historical payment records.
        if (s.active === false) continue;
        components = expectedComponents(fee, month);
        total = components.reduce((sum, c) => sum + c.amount, 0);
        if (total <= 0) continue; // nothing is due this month for this class
        paidAmount = 0;
        status = "unpaid";
      }

      if (statusFilter && status !== statusFilter) continue;

      rows.push({
        id: paid ? paid._id.toString() : `${sid}-${year}-${month}`,
        studentId: sid,
        name: s.name,
        roll: s.roll,
        phone: s.phone ?? "",
        className: classMap.get(s.classId) ?? "—",
        sectionName: sectionMap.get(s.sectionId) ?? "—",
        year,
        month,
        period: `${monthName(month)} ${toBnDigits(year)}`,
        components,
        total,
        paid: paidAmount,
        due: Math.max(0, total - paidAmount),
        status,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.className.localeCompare(b.className) ||
      a.roll.localeCompare(b.roll)
  );
}

export type DashboardStats = {
  activeStudents: number;
  totalStudents: number;
  todayCollection: number;
  monthCollection: number;
  monthDue: number;
  yearCollection: number;
  yearDue: number;
  monthly: number[]; // 12 entries: collection per month of the year
};

export async function getDashboardStats(
  db: ScopedDb,
  year: number,
  month: number
): Promise<DashboardStats> {
  // Bounds of "today" for the daily collection figure (paidAt is a Date).
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [activeStudents, totalStudents, yearAggCur, todayAggCur] = await Promise.all([
    db.collection(Collections.students).countDocuments({ active: true }),
    db.collection(Collections.students).countDocuments({}),
    db
      .collection<PaymentDoc>(Collections.payments)
      .aggregate<{ _id: number; paid: number; total: number }>([
        { $match: { year } },
        { $group: { _id: "$month", paid: { $sum: "$paidAmount" }, total: { $sum: "$totalAmount" } } },
      ]),
    db
      .collection<PaymentDoc>(Collections.payments)
      .aggregate<{ paid: number }>([
        { $match: { paidAt: { $gte: dayStart, $lt: dayEnd } } },
        { $group: { _id: null, paid: { $sum: "$paidAmount" } } },
      ]),
  ]);

  const yearRows = await yearAggCur.toArray();
  const monthly = Array.from({ length: 12 }, () => 0);
  let yearCollection = 0;
  let yearDue = 0;
  let monthCollection = 0;
  let monthDue = 0;
  for (const r of yearRows) {
    const paid = r.paid ?? 0;
    const due = Math.max(0, (r.total ?? 0) - paid);
    if (r._id >= 1 && r._id <= 12) monthly[r._id - 1] = paid;
    yearCollection += paid;
    yearDue += due;
    if (r._id === month) {
      monthCollection = paid;
      monthDue = due;
    }
  }
  const todayCollection = (await todayAggCur.toArray())[0]?.paid ?? 0;

  return {
    activeStudents,
    totalStudents,
    todayCollection,
    monthCollection,
    monthDue,
    yearCollection,
    yearDue,
    monthly,
  };
}
