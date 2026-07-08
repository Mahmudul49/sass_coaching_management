"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  Collections,
  type StudentDoc,
  type PaymentDoc,
  type PaymentComponent,
  type PaymentStatus,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { sendSms } from "@/lib/sms";
import { smsTemplates } from "@/lib/sms/templates";
import { revalidateTenantAdminLayout } from "@/lib/tenant/revalidate";

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

export async function savePayment(input: SavePaymentInput): Promise<SaveResult> {
  const { db, tenant } = await requireAdminFromRequest();
  if (!input.studentId || !input.classId) return { ok: false, error: "তথ্য অসম্পূর্ণ।" };

  const student = (await db
    .collection<StudentDoc>(Collections.students)
    .findOne({ _id: toObjectId(input.studentId)! } as never)) as StudentDoc | null;
  if (!student) return { ok: false, error: "শিক্ষার্থী পাওয়া যায়নি।" };

  const components = (input.components ?? [])
    .map((c) => ({
      type: String(c.type),
      label: String(c.label),
      amount: Math.max(0, Number(c.amount) || 0),
    }))
    .filter((c) => c.amount > 0 || c.type === "monthly");

  const totalAmount = components.reduce((sum, c) => sum + c.amount, 0);
  const paidAmount = Math.max(0, Math.min(Number(input.paidAmount) || 0, totalAmount));
  const status = computeStatus(totalAmount, paidAmount);

  await db.collection(Collections.payments).updateOne(
    { studentId: input.studentId, year: input.year, month: input.month },
    {
      $set: {
        classId: input.classId,
        components,
        totalAmount,
        paidAmount,
        status,
        paidAt: paidAmount > 0 ? new Date() : null,
        remarks: String(input.remarks ?? "").trim().slice(0, 500),
      },
      $setOnInsert: {
        studentId: input.studentId,
        year: input.year,
        month: input.month,
      },
    },
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
