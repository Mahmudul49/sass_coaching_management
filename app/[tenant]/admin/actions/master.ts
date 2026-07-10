"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import { Collections } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { revalidateTenantAdminLayout } from "@/lib/tenant/revalidate";

export type ActionResult = { ok: boolean; error?: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

/* ───────────────────────── Classes ───────────────────────── */

export async function createClass(name: string, order?: number): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const n = name?.trim();
  if (!n) return fail("ক্লাসের নাম দিন।");
  const dup = await db.collection(Collections.classes).findOne({ name: n });
  if (dup) return fail("এই নামে ক্লাস আগে থেকেই আছে।");
  await db.collection(Collections.classes).insertOne({ name: n, order: order ?? 0 } as never);
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Per-student fee override ───────────────────────── */

/**
 * Set (or clear) a student's payable for a specific month. This overrides the
 * class fee structure for that student-month in ALL calculations and reports:
 *   - a positive amount → that month's payable;
 *   - 0 → the student is Not Enrolled that month (excluded from payable/due/collection);
 *   - null → remove the override and fall back to the class fee structure.
 * Reports recompute automatically (nothing derived is stored).
 */
export async function setStudentFeeOverride(
  studentId: string,
  year: number,
  month: number,
  payable: number | null
): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const sid = toObjectId(studentId);
  if (!sid) return fail("ভুল আইডি।");
  const y = Math.round(Number(year));
  const m = Math.round(Number(month));
  if (!Number.isFinite(y) || y < 2000 || y > 3000) return fail("ভুল বছর।");
  if (!(m >= 1 && m <= 12)) return fail("ভুল মাস।");

  const student = await db.collection(Collections.students).findOne({ _id: sid } as never);
  if (!student) return fail("শিক্ষার্থী পাওয়া যায়নি।");

  if (payable === null) {
    await db.collection(Collections.feeOverride).deleteOne({ studentId, year: y, month: m } as never);
  } else {
    const amt = Math.max(0, Number(payable) || 0);
    await db.collection(Collections.feeOverride).updateOne(
      { studentId, year: y, month: m },
      { $set: { payable: amt, updatedAt: new Date() }, $setOnInsert: { studentId, year: y, month: m } },
      { upsert: true }
    );
  }
  await revalidateTenantAdminLayout();
  return ok;
}

export async function updateClass(
  id: string,
  name: string,
  order: number
): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const n = name?.trim();
  if (!n) return fail("ক্লাসের নাম দিন।");
  await db
    .collection(Collections.classes)
    .updateOne({ _id } as never, { $set: { name: n, order: order ?? 0 } });
  await revalidateTenantAdminLayout();
  return ok;
}

export async function deleteClass(id: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const students = await db.collection(Collections.students).countDocuments({ classId: id });
  if (students > 0) return fail("এই ক্লাসে শিক্ষার্থী আছে — আগে শিক্ষার্থী সরান।");
  await db.collection(Collections.classes).deleteOne({ _id } as never);
  await db.collection(Collections.sections).deleteMany({ classId: id });
  await db.collection(Collections.feeStructure).deleteMany({ classId: id });
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Sections ───────────────────────── */

export async function createSection(classId: string, name: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const n = name?.trim();
  if (!classId) return fail("ক্লাস নির্বাচন করুন।");
  if (!n) return fail("শাখার নাম দিন।");
  const cls = await db.collection(Collections.classes).findOne({ _id: toObjectId(classId)! } as never);
  if (!cls) return fail("ক্লাস পাওয়া যায়নি।");
  const dup = await db.collection(Collections.sections).findOne({ classId, name: n });
  if (dup) return fail("এই শাখা আগে থেকেই আছে।");
  await db.collection(Collections.sections).insertOne({ classId, name: n } as never);
  await revalidateTenantAdminLayout();
  return ok;
}

export async function updateSection(id: string, name: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const n = name?.trim();
  if (!n) return fail("শাখার নাম দিন।");
  await db.collection(Collections.sections).updateOne({ _id } as never, { $set: { name: n } });
  await revalidateTenantAdminLayout();
  return ok;
}

export async function deleteSection(id: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const students = await db.collection(Collections.students).countDocuments({ sectionId: id });
  if (students > 0) return fail("এই শাখায় শিক্ষার্থী আছে — আগে শিক্ষার্থী সরান।");
  await db.collection(Collections.sections).deleteOne({ _id } as never);
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Fee structure ───────────────────────── */

export type FeeInput = {
  classId: string;
  admissionFee: number;
  admissionMonth: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number; enabled: boolean };
  modelTestAnnual: { amount: number; month: number; enabled: boolean };
  others: { label: string; amount: number; month: number }[];
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const clampMonth = (m: unknown) => {
  const n = Math.round(Number(m));
  return n >= 1 && n <= 12 ? n : 1;
};

export async function saveFeeStructure(input: FeeInput): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  if (!input.classId) return fail("ক্লাস নির্বাচন করুন।");
  const cls = await db
    .collection(Collections.classes)
    .findOne({ _id: toObjectId(input.classId)! } as never);
  if (!cls) return fail("ক্লাস পাওয়া যায়নি।");

  const others = (input.others ?? [])
    .map((o) => ({
      label: String(o.label ?? "").trim(),
      amount: num(o.amount),
      month: clampMonth(o.month),
    }))
    .filter((o) => o.label);

  await db.collection(Collections.feeStructure).updateOne(
    { classId: input.classId },
    {
      $set: {
        admissionFee: num(input.admissionFee),
        admissionMonth: clampMonth(input.admissionMonth),
        monthlyFee: num(input.monthlyFee),
        modelTestHalfYearly: {
          amount: num(input.modelTestHalfYearly?.amount),
          month: clampMonth(input.modelTestHalfYearly?.month),
          enabled: input.modelTestHalfYearly?.enabled !== false,
        },
        modelTestAnnual: {
          amount: num(input.modelTestAnnual?.amount),
          month: clampMonth(input.modelTestAnnual?.month),
          enabled: input.modelTestAnnual?.enabled !== false,
        },
        others,
      },
      $setOnInsert: { classId: input.classId },
    },
    { upsert: true }
  );
  await revalidateTenantAdminLayout();
  return ok;
}
