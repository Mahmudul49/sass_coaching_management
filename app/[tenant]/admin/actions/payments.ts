"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  Collections,
  type StudentDoc,
  type PaymentDoc,
  type PaymentComponent,
  type PaymentStatus,
  type SmsKind,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { sendSms, sendSmsBatch } from "@/lib/sms";
import { smsTemplates } from "@/lib/sms/templates";
import { revalidateTenantAdminLayout } from "@/lib/tenant/revalidate";
import { buildPaymentRows, listClasses, type PayColumn, type PayRow } from "@/lib/admin/queries";
import type { AnyBulkWriteOperation } from "mongodb";

export type PaymentRowsResult = { template: PayColumn[]; rows: PayRow[]; className: string };

/**
 * Fetch the payment grid for a class/month/year WITHOUT a page navigation — the
 * client swaps class/month/year in place and re-renders the grid from this,
 * instead of router.push'ing the URL (no reload).
 */
export async function loadPaymentRows(
  classId: string,
  year: number,
  month: number
): Promise<PaymentRowsResult> {
  const { db } = await requireAdminFromRequest();
  const [built, classes] = await Promise.all([
    buildPaymentRows(db, classId, year, month),
    listClasses(db),
  ]);
  const className = classes.find((c) => c.id === classId)?.name ?? "";
  return { template: built.template, rows: built.rows, className };
}

export type SavePaymentInput = {
  studentId: string;
  classId: string;
  year: number;
  month: number;
  components: PaymentComponent[];
  paidAmount: number;
  remarks?: string; // optional progress note
};
export type SaveResult = { ok: boolean; error?: string; status?: PaymentStatus };

function computeStatus(total: number, paid: number): PaymentStatus {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

/**
 * Normalise a raw payment input into the persisted shape (sanitise components,
 * derive total, clamp paid, compute status). Shared by the single-row and bulk
 * save paths so they can never diverge.
 */
function normalizePayment(input: SavePaymentInput) {
  const components = (input.components ?? [])
    .map((c) => ({
      type: String(c.type),
      label: String(c.label),
      amount: Math.max(0, Number(c.amount) || 0),
    }))
    .filter((c) => c.amount > 0 || c.type === "monthly");
  const totalAmount = components.reduce((sum, c) => sum + c.amount, 0);
  // Paid is NOT capped at this month's total: an admin may collect more than is
  // due this month (an advance). The surplus is carried to other months by the
  // chronological allocation engine (lib/fees/allocate.ts) at read time — the due
  // report / matrix spread the student's whole paid pool across their payables.
  const paidAmount = Math.max(0, Number(input.paidAmount) || 0);
  return { components, totalAmount, paidAmount, status: computeStatus(totalAmount, paidAmount) };
}

/** The upsert body for one payment row (identical for single + bulk saves). */
function paymentUpdate(
  input: SavePaymentInput,
  n: ReturnType<typeof normalizePayment>,
  now: Date
) {
  return {
    $set: {
      classId: input.classId,
      components: n.components,
      totalAmount: n.totalAmount,
      paidAmount: n.paidAmount,
      status: n.status,
      paidAt: n.paidAmount > 0 ? now : null,
      remarks: String(input.remarks ?? "").trim().slice(0, 500),
    },
    $setOnInsert: {
      studentId: input.studentId,
      year: input.year,
      month: input.month,
    },
  };
}

export async function savePayment(input: SavePaymentInput): Promise<SaveResult> {
  const { db, tenant } = await requireAdminFromRequest();
  if (!input.studentId || !input.classId) return { ok: false, error: "তথ্য অসম্পূর্ণ।" };

  const student = (await db
    .collection<StudentDoc>(Collections.students)
    .findOne({ _id: toObjectId(input.studentId)! } as never)) as StudentDoc | null;
  if (!student) return { ok: false, error: "শিক্ষার্থী পাওয়া যায়নি।" };

  const { components, totalAmount, paidAmount, status } = normalizePayment(input);

  await db.collection(Collections.payments).updateOne(
    { studentId: input.studentId, year: input.year, month: input.month },
    paymentUpdate(input, { components, totalAmount, paidAmount, status }, new Date()),
    { upsert: true }
  );

  // Payment SMS is always on.
  if (student.phone) {
    await sendSms({
      to: student.phone,
      tenantId: tenant.id,
      studentId: input.studentId,
      kind: "payment_received",
      body: smsTemplates.paymentReceived({
        centerName: tenant.name,
        studentName: student.name,
        month: input.month,
        year: input.year,
        paid: paidAmount,
        due: totalAmount - paidAmount,
      }),
    });
  }

  // Cache-invalidate the whole admin area so dashboard cards + reports reflect
  // the new payment without a manual refresh.
  await revalidateTenantAdminLayout();
  return { ok: true, status };
}

export type BulkSaveResult = {
  ok: boolean;
  saved: number;
  skipped: number;
  notified: number;
  failed: number;
  error?: string;
};

/**
 * Save every payment row for a class/month in ONE request.
 *
 * Replaces the old "loop savePayment N times" path (N server round-trips, N auth
 * checks, 2N DB queries, N revalidations). Instead: one auth, one `$in` student
 * fetch, one `bulkWrite` upsert, one revalidation. Scales from a handful of rows
 * to a full 100+ student class without fanning out requests.
 *
 * SMS: opt-in only. When `options.sendSms` is true, every student with a phone
 * is notified based on payment status — a "payment received" text to whoever paid
 * (paidAmount > 0) and a "please pay your due" reminder to whoever still owes.
 * When it is false/omitted, NO SMS is sent (the default), so a routine bulk save
 * never fans out texts or incurs gateway cost. Single-row Save is unchanged.
 */
export async function savePaymentsBulk(
  inputs: SavePaymentInput[],
  options: { sendSms?: boolean } = {}
): Promise<BulkSaveResult> {
  const { db, tenant } = await requireAdminFromRequest();
  if (!inputs?.length) return { ok: true, saved: 0, skipped: 0, notified: 0, failed: 0 };

  // Validate ids + fetch names/phones for every row in a single query.
  const objIds = inputs
    .map((i) => toObjectId(i.studentId))
    .filter((o): o is NonNullable<typeof o> => !!o);
  const students = (await db
    .collection<StudentDoc>(Collections.students)
    .findArray({ _id: { $in: objIds } } as never, {
      projection: { name: 1, phone: 1 },
    })) as StudentDoc[];
  const byId = new Map(students.map((s) => [s._id.toString(), s]));

  const now = new Date();
  const ops: AnyBulkWriteOperation<PaymentDoc>[] = [];
  const smsMessages: Array<{ to: string; body: string; studentId: string; kind: SmsKind }> = [];
  let skipped = 0;

  for (const input of inputs) {
    const student = byId.get(input.studentId);
    if (!input.studentId || !input.classId || !student) {
      skipped++; // row references a missing/invalid student — reported back, not fatal
      continue;
    }
    const n = normalizePayment(input);
    ops.push({
      updateOne: {
        filter: { studentId: input.studentId, year: input.year, month: input.month } as never,
        update: paymentUpdate(input, n, now) as never,
        upsert: true,
      },
    });
    // Status-based SMS (opt-in). Payers get a receipt; anyone still owing gets a
    // due reminder. Students with nothing payable are left alone.
    if (options.sendSms && student.phone) {
      const due = n.totalAmount - n.paidAmount;
      if (n.paidAmount > 0) {
        smsMessages.push({
          to: student.phone,
          studentId: input.studentId,
          kind: "payment_received",
          body: smsTemplates.paymentReceived({
            centerName: tenant.name,
            studentName: student.name,
            month: input.month,
            year: input.year,
            paid: n.paidAmount,
            due,
          }),
        });
      } else if (due > 0) {
        smsMessages.push({
          to: student.phone,
          studentId: input.studentId,
          kind: "payment_due",
          body: smsTemplates.paymentDue({
            centerName: tenant.name,
            studentName: student.name,
            month: input.month,
            year: input.year,
            due,
          }),
        });
      }
    }
  }

  // One round-trip for every upsert; unordered so one bad row can't abort the
  // rest — on a partial failure Mongo throws but still reports how many landed.
  let saved = 0;
  let failed = 0;
  let error: string | undefined;
  if (ops.length) {
    try {
      const res = await db
        .collection<PaymentDoc>(Collections.payments)
        .bulkWrite(ops, { ordered: false });
      saved = (res.upsertedCount ?? 0) + (res.matchedCount ?? 0); // created + found(updated)
      failed = ops.length - saved;
    } catch (err) {
      // MongoBulkWriteError: some ops may have succeeded before the failure(s).
      const r = (err as { result?: { nUpserted?: number; nMatched?: number } }).result;
      saved = r ? (r.nUpserted ?? 0) + (r.nMatched ?? 0) : 0;
      failed = ops.length - saved;
      error = "কিছু পেমেন্ট সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।";
    }
  }

  // Revalidate once (not per row) so dashboard cards + reports reflect saves.
  await revalidateTenantAdminLayout();

  // Notifications after the data is committed — never let SMS failure fail a save
  // that already succeeded.
  let notified = 0;
  if (smsMessages.length) {
    try {
      notified = (await sendSmsBatch(tenant.id, smsMessages)).sent;
    } catch {
      // swallow: the payments are saved; SMS is best-effort.
    }
  }

  return { ok: failed === 0, saved, skipped, notified, failed, error };
}

export async function resendPaymentSms(
  studentId: string,
  year: number,
  month: number
): Promise<SaveResult> {
  const { db, tenant } = await requireAdminFromRequest();
  const [student, payment] = await Promise.all([
    db.collection<StudentDoc>(Collections.students).findOne({
      _id: toObjectId(studentId)!,
    } as never) as Promise<StudentDoc | null>,
    db.collection<PaymentDoc>(Collections.payments).findOne({
      studentId,
      year,
      month,
    }) as Promise<PaymentDoc | null>,
  ]);
  if (!student?.phone) return { ok: false, error: "ফোন নম্বর নেই।" };
  if (!payment) return { ok: false, error: "পেমেন্ট পাওয়া যায়নি।" };

  await sendSms({
    to: student.phone,
    tenantId: tenant.id,
    studentId,
    kind: "payment_received",
    body: smsTemplates.paymentReceived({
      centerName: tenant.name,
      studentName: student.name,
      month,
      year,
      paid: payment.paidAmount,
      due: payment.totalAmount - payment.paidAmount,
    }),
  });
  return { ok: true };
}
