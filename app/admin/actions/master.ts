"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { Collections } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";

export type ActionResult = { ok: boolean; error?: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

/* ───────────────────────── Classes ───────────────────────── */

export async function createClass(name: string, order?: number): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const n = name?.trim();
  if (!n) return fail("ক্লাসের নাম দিন।");
  const dup = await db.collection(Collections.classes).findOne({ name: n });
  if (dup) return fail("এই নামে ক্লাস আগে থেকেই আছে।");
  await db.collection(Collections.classes).insertOne({ name: n, order: order ?? 0 } as never);
  revalidateAdmin();
  return ok;
}

export async function updateClass(
  id: string,
  name: string,
  order: number
): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const n = name?.trim();
  if (!n) return fail("ক্লাসের নাম দিন।");
  await db
    .collection(Collections.classes)
    .updateOne({ _id } as never, { $set: { name: n, order: order ?? 0 } });
  revalidateAdmin();
  return ok;
}

export async function deleteClass(id: string): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const students = await db.collection(Collections.students).countDocuments({ classId: id });
  if (students > 0) return fail("এই ক্লাসে ছাত্র আছে — আগে ছাত্র সরান।");
  await db.collection(Collections.classes).deleteOne({ _id } as never);
  await db.collection(Collections.sections).deleteMany({ classId: id });
  await db.collection(Collections.feeStructure).deleteMany({ classId: id });
  revalidateAdmin();
  return ok;
}

/* ───────────────────────── Sections ───────────────────────── */

export async function createSection(classId: string, name: string): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const n = name?.trim();
  if (!classId) return fail("ক্লাস নির্বাচন করুন।");
  if (!n) return fail("শাখার নাম দিন।");
  const cls = await db.collection(Collections.classes).findOne({ _id: toObjectId(classId)! } as never);
  if (!cls) return fail("ক্লাস পাওয়া যায়নি।");
  const dup = await db.collection(Collections.sections).findOne({ classId, name: n });
  if (dup) return fail("এই শাখা আগে থেকেই আছে।");
  await db.collection(Collections.sections).insertOne({ classId, name: n } as never);
  revalidateAdmin();
  return ok;
}

export async function updateSection(id: string, name: string): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const n = name?.trim();
  if (!n) return fail("শাখার নাম দিন।");
  await db.collection(Collections.sections).updateOne({ _id } as never, { $set: { name: n } });
  revalidateAdmin();
  return ok;
}

export async function deleteSection(id: string): Promise<ActionResult> {
  const { db } = await requireAdmin();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const students = await db.collection(Collections.students).countDocuments({ sectionId: id });
  if (students > 0) return fail("এই শাখায় ছাত্র আছে — আগে ছাত্র সরান।");
  await db.collection(Collections.sections).deleteOne({ _id } as never);
  revalidateAdmin();
  return ok;
}

/* ───────────────────────── Fee structure ───────────────────────── */

export type FeeInput = {
  classId: string;
  admissionFee: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number };
  modelTestAnnual: { amount: number; month: number };
  others: { label: string; amount: number }[];
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
  const { db } = await requireAdmin();
  if (!input.classId) return fail("ক্লাস নির্বাচন করুন।");
  const cls = await db
    .collection(Collections.classes)
    .findOne({ _id: toObjectId(input.classId)! } as never);
  if (!cls) return fail("ক্লাস পাওয়া যায়নি।");

  const others = (input.others ?? [])
    .map((o) => ({ label: String(o.label ?? "").trim(), amount: num(o.amount) }))
    .filter((o) => o.label);

  await db.collection(Collections.feeStructure).updateOne(
    { classId: input.classId },
    {
      $set: {
        admissionFee: num(input.admissionFee),
        monthlyFee: num(input.monthlyFee),
        modelTestHalfYearly: {
          amount: num(input.modelTestHalfYearly?.amount),
          month: clampMonth(input.modelTestHalfYearly?.month),
        },
        modelTestAnnual: {
          amount: num(input.modelTestAnnual?.amount),
          month: clampMonth(input.modelTestAnnual?.month),
        },
        others,
      },
      $setOnInsert: { classId: input.classId },
    },
    { upsert: true }
  );
  revalidateAdmin();
  return ok;
}
