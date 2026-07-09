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
import { toObjectId } from "@/lib/db/oid";

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
    .findArray(q, {
      sort: { roll: 1 },
      // Projection: fetch only fields the UI needs — cuts Atlas transfer + memory.
      projection: STUDENT_ROW_PROJECTION,
    })) as StudentDoc[];

  return docs.map((s) => mapStudentRow(s, classMap, sectionMap));
}

const STUDENT_ROW_PROJECTION = {
  classId: 1,
  sectionId: 1,
  name: 1,
  roll: 1,
  phone: 1,
  active: 1,
} as const;

function mapStudentRow(
  s: StudentDoc,
  classMap: Map<string, string>,
  sectionMap: Map<string, string>
): StudentRow {
  return {
    id: s._id.toString(),
    classId: s.classId,
    sectionId: s.sectionId,
    className: classMap.get(s.classId) ?? "—",
    sectionName: sectionMap.get(s.sectionId) ?? "—",
    name: s.name,
    roll: s.roll,
    phone: s.phone,
    active: s.active !== false,
  };
}

export type StudentsPage = { rows: StudentRow[]; nextCursor: string | null };

/**
 * Cursor-paginated student list — the scalable path for 100K+ students. Cursor
 * is the last `_id` of the previous page (stable, unique, index-backed). Fetches
 * `limit + 1` to detect a next page without a separate count. Search is a
 * case-insensitive regex on name/roll/phone.
 */
export async function listStudentsPaged(
  db: ScopedDb,
  filter: { classId?: string; status?: "active" | "inactive" | "all"; search?: string } = {},
  page: { limit?: number; cursor?: string | null } = {}
): Promise<StudentsPage> {
  const limit = Math.min(Math.max(page.limit ?? 50, 1), 200);
  const [classes, sections] = await Promise.all([listClasses(db), listSections(db)]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));

  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (filter.status === "active") q.active = true;
  else if (filter.status === "inactive") q.active = false;
  const search = filter.search?.trim();
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, "i");
    q.$or = [{ name: re }, { roll: re }, { phone: re }];
  }
  if (page.cursor) {
    const oid = toObjectId(page.cursor);
    if (oid) q._id = { $gt: oid };
  }

  const docs = (await db.collection<StudentDoc>(Collections.students).findArray(q, {
    sort: { _id: 1 },
    limit: limit + 1,
    projection: STUDENT_ROW_PROJECTION,
  })) as StudentDoc[];

  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;
  const rows = slice.map((s) => mapStudentRow(s, classMap, sectionMap));
  const nextCursor = hasMore ? slice[slice.length - 1]._id.toString() : null;
  return { rows, nextCursor };
}

/** Active student count per class (single aggregation, no full scan to client). */
export async function getActiveCountsByClass(db: ScopedDb): Promise<Record<string, number>> {
  const agg = await (
    await db.collection<StudentDoc>(Collections.students).aggregate<{ _id: string; n: number }>([
      { $match: { active: true } },
      { $group: { _id: "$classId", n: { $sum: 1 } } },
    ])
  ).toArray();
  const m: Record<string, number> = {};
  for (const r of agg) m[r._id] = r.n;
  return m;
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
 * Expected fee components for a class in a given month. Each month-bound fee
 * (admission, model tests, others) applies only in its configured month;
 * undefined month = legacy "every month".
 */
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

/** Shared, immutable context for building due rows across paged/summary/all. */
type DueContext = {
  lo: number;
  hi: number;
  months: { year: number; month: number }[];
  statusFilter: string;
  classMap: Map<string, string>;
  sectionMap: Map<string, string>;
  feeByClass: Map<string, FeeStructureDoc>;
};

const DUE_STUDENT_PROJECTION = { name: 1, roll: 1, phone: 1, classId: 1, sectionId: 1, active: 1 } as const;
const DUE_PAYMENT_PROJECTION = {
  studentId: 1,
  classId: 1,
  year: 1,
  month: 1,
  components: 1,
  totalAmount: 1,
  paidAmount: 1,
  status: 1,
} as const;

function payKey(studentId: string, year: number, month: number) {
  return `${studentId}:${year}:${month}`;
}

/** Build the master-data + range context once (small, tenant-scoped reads). */
async function loadDueContext(
  db: ScopedDb,
  filter: { from: string; to: string; status?: string }
): Promise<DueContext> {
  const fromYM = ymKeyFromDate(filter.from) ?? 0;
  const toYM = ymKeyFromDate(filter.to) ?? 999912;
  const [lo, hi] = fromYM <= toYM ? [fromYM, toYM] : [toYM, fromYM];
  const statusFilter =
    filter.status && ["paid", "partial", "unpaid"].includes(filter.status) ? filter.status : "";
  const [classes, sections, fees] = await Promise.all([
    listClasses(db),
    listSections(db),
    db.collection<FeeStructureDoc>(Collections.feeStructure).findArray({}) as Promise<FeeStructureDoc[]>,
  ]);
  return {
    lo,
    hi,
    months: monthsInRange(lo, hi),
    statusFilter,
    classMap: new Map(classes.map((c) => [c.id, c.name])),
    sectionMap: new Map(sections.map((s) => [s.id, s.name])),
    feeByClass: new Map(fees.map((f) => [f.classId, f])),
  };
}

/** Load payment records in range for a specific set of students (bounded). */
async function loadPaymentsForStudents(
  db: ScopedDb,
  ctx: DueContext,
  studentIds: string[]
): Promise<Map<string, PaymentDoc>> {
  if (studentIds.length === 0) return new Map();
  const q: Record<string, unknown> = {
    studentId: { $in: studentIds },
    $expr: {
      $and: [
        { $gte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, ctx.lo] },
        { $lte: [{ $add: [{ $multiply: ["$year", 100] }, "$month"] }, ctx.hi] },
      ],
    },
  };
  const payments = (await db
    .collection<PaymentDoc>(Collections.payments)
    .findArray(q, { projection: DUE_PAYMENT_PROJECTION })) as PaymentDoc[];
  return new Map(payments.map((p) => [payKey(p.studentId, p.year, p.month), p]));
}

/**
 * Pure per-student expansion: for one student, emit a due row per month in the
 * range (real payment overlaid if present; projected unpaid for active students
 * without a record). Same logic for every consumer, so totals/list/export/matrix
 * can never diverge.
 */
function dueRowsForStudent(s: StudentDoc, ctx: DueContext, payMap: Map<string, PaymentDoc>): DueRow[] {
  const out: DueRow[] = [];
  const sid = s._id.toString();
  const fee = ctx.feeByClass.get(s.classId);
  for (const { year, month } of ctx.months) {
    const paid = payMap.get(payKey(sid, year, month));

    let total: number;
    let paidAmount: number;
    let components: { label: string; amount: number }[];
    let status: "paid" | "partial" | "unpaid";

    if (paid) {
      total = paid.totalAmount;
      paidAmount = paid.paidAmount;
      components = (paid.components ?? []).map((c) => ({ label: c.label, amount: c.amount }));
      status = paid.status;
    } else {
      if (s.active === false) continue;
      components = expectedComponents(fee, month);
      total = components.reduce((sum, c) => sum + c.amount, 0);
      if (total <= 0) continue;
      paidAmount = 0;
      status = "unpaid";
    }

    if (ctx.statusFilter && status !== ctx.statusFilter) continue;

    out.push({
      id: paid ? paid._id.toString() : `${sid}-${year}-${month}`,
      studentId: sid,
      name: s.name,
      roll: s.roll,
      phone: s.phone ?? "",
      className: ctx.classMap.get(s.classId) ?? "—",
      sectionName: ctx.sectionMap.get(s.sectionId) ?? "—",
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
  return out;
}

function sortDueRows(rows: DueRow[]): DueRow[] {
  return rows.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.className.localeCompare(b.className) ||
      a.roll.localeCompare(b.roll)
  );
}

/**
 * Fee-structure-driven due report (full, unpaginated). Retained for callers that
 * need the whole set at once. For large tenants prefer getDueReportPaged (list),
 * getDueReportSummary (totals) and getDueReportAll (export/matrix, capped).
 */
export async function getDueReport(
  db: ScopedDb,
  filter: { classId?: string; from: string; to: string; status?: string }
): Promise<DueRow[]> {
  const ctx = await loadDueContext(db, filter);
  const studentQuery: Record<string, unknown> = {};
  if (filter.classId) studentQuery.classId = filter.classId;
  const students = (await db
    .collection<StudentDoc>(Collections.students)
    .findArray(studentQuery, { projection: DUE_STUDENT_PROJECTION })) as StudentDoc[];
  const payMap = await loadPaymentsForStudents(
    db,
    ctx,
    students.map((s) => s._id.toString())
  );
  const rows: DueRow[] = [];
  for (const s of students) rows.push(...dueRowsForStudent(s, ctx, payMap));
  return sortDueRows(rows);
}

export type DuePage = { rows: DueRow[]; nextCursor: string | null };

/**
 * Cursor-paginated due report. Pages STUDENTS by _id (a page = `limit` students
 * expanded across every month in range), loading payments only for that page.
 * Bounded memory + network: never loads/ships the whole collection.
 */
export async function getDueReportPaged(
  db: ScopedDb,
  filter: { classId?: string; from: string; to: string; status?: string },
  page: { limit?: number; cursor?: string | null } = {}
): Promise<DuePage> {
  const limit = Math.min(Math.max(page.limit ?? 40, 1), 200);
  const ctx = await loadDueContext(db, filter);
  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (page.cursor) {
    const oid = toObjectId(page.cursor);
    if (oid) q._id = { $gt: oid };
  }
  const students = (await db
    .collection<StudentDoc>(Collections.students)
    .findArray(q, { sort: { _id: 1 }, limit: limit + 1, projection: DUE_STUDENT_PROJECTION })) as StudentDoc[];
  const hasMore = students.length > limit;
  const slice = hasMore ? students.slice(0, limit) : students;
  const payMap = await loadPaymentsForStudents(
    db,
    ctx,
    slice.map((s) => s._id.toString())
  );
  const rows: DueRow[] = [];
  for (const s of slice) rows.push(...dueRowsForStudent(s, ctx, payMap));
  const nextCursor = hasMore ? slice[slice.length - 1]._id.toString() : null;
  return { rows: sortDueRows(rows), nextCursor };
}

export type DueSummary = { totalDue: number; totalPaid: number; count: number };

/**
 * Report totals (due / collected / row count) computed server-side by streaming
 * students in cursor batches — exact (reuses dueRowsForStudent), bounded memory,
 * and only 3 numbers cross the wire instead of every row.
 */
export async function getDueReportSummary(
  db: ScopedDb,
  filter: { classId?: string; from: string; to: string; status?: string }
): Promise<DueSummary> {
  const ctx = await loadDueContext(db, filter);
  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  const BATCH = 500;
  let totalDue = 0;
  let totalPaid = 0;
  let count = 0;
  let cursor: string | null = null;
  for (;;) {
    const bq: Record<string, unknown> = { ...q };
    if (cursor) {
      const oid = toObjectId(cursor);
      if (oid) bq._id = { $gt: oid };
    }
    const batch = (await db
      .collection<StudentDoc>(Collections.students)
      .findArray(bq, { sort: { _id: 1 }, limit: BATCH, projection: DUE_STUDENT_PROJECTION })) as StudentDoc[];
    if (batch.length === 0) break;
    const payMap = await loadPaymentsForStudents(
      db,
      ctx,
      batch.map((s) => s._id.toString())
    );
    for (const s of batch) {
      for (const r of dueRowsForStudent(s, ctx, payMap)) {
        totalDue += r.due;
        totalPaid += r.paid;
        count += 1;
      }
    }
    if (batch.length < BATCH) break;
    cursor = batch[batch.length - 1]._id.toString();
  }
  return { totalDue, totalPaid, count };
}

export type DueReportAll = { rows: DueRow[]; capped: boolean };

/**
 * Full row set for export / matrix, built server-side in cursor batches with a
 * hard cap so a huge From–To × all-classes selection can't exhaust memory. When
 * `capped` is true the client should warn that the export/matrix is truncated.
 */
export async function getDueReportAll(
  db: ScopedDb,
  filter: { classId?: string; from: string; to: string; status?: string },
  cap = 20000
): Promise<DueReportAll> {
  const ctx = await loadDueContext(db, filter);
  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  const BATCH = 500;
  const rows: DueRow[] = [];
  let capped = false;
  let cursor: string | null = null;
  for (;;) {
    const bq: Record<string, unknown> = { ...q };
    if (cursor) {
      const oid = toObjectId(cursor);
      if (oid) bq._id = { $gt: oid };
    }
    const batch = (await db
      .collection<StudentDoc>(Collections.students)
      .findArray(bq, { sort: { _id: 1 }, limit: BATCH, projection: DUE_STUDENT_PROJECTION })) as StudentDoc[];
    if (batch.length === 0) break;
    const payMap = await loadPaymentsForStudents(
      db,
      ctx,
      batch.map((s) => s._id.toString())
    );
    for (const s of batch) {
      rows.push(...dueRowsForStudent(s, ctx, payMap));
      if (rows.length >= cap) {
        capped = true;
        break;
      }
    }
    if (capped || batch.length < BATCH) break;
    cursor = batch[batch.length - 1]._id.toString();
  }
  return { rows: sortDueRows(rows.slice(0, cap)), capped };
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
