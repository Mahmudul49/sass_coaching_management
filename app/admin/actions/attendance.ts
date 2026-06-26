"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import {
  Collections,
  type StudentDoc,
  type AttendanceStatus,
  type AttendanceDoc,
  type SmsKind,
} from "@/lib/db/collections";
import { sendSmsBatch } from "@/lib/sms";
import { smsTemplates } from "@/lib/sms/templates";

export type AttendanceInput = {
  classId: string;
  date: string; // YYYY-MM-DD
  statuses: { studentId: string; status: AttendanceStatus }[];
};
export type SaveResult = { ok: boolean; error?: string; smsSent?: number };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function persistAndNotify(
  input: AttendanceInput,
  resend: boolean
): Promise<SaveResult> {
  const { db, tenant } = await requireAdmin();
  if (!input.classId) return { ok: false, error: "ক্লাস নির্বাচন করুন।" };
  if (!DATE_RE.test(input.date)) return { ok: false, error: "তারিখ সঠিক নয়।" };

  // Load this class's students once (for phones + names).
  const students = (await db
    .collection<StudentDoc>(Collections.students)
    .findArray({ classId: input.classId, active: true })) as StudentDoc[];
  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

  let statuses = input.statuses;

  if (resend) {
    // Re-fire SMS for the CURRENT saved state (ignore incoming statuses).
    const saved = (await db
      .collection<AttendanceDoc>(Collections.attendance)
      .findArray({ classId: input.classId, date: input.date })) as AttendanceDoc[];
    statuses = saved.map((a) => ({ studentId: a.studentId, status: a.status }));
  } else {
    // Upsert each student's status for this (classId, date).
    for (const s of statuses) {
      if (!studentMap.has(s.studentId)) continue;
      await db.collection(Collections.attendance).updateOne(
        { classId: input.classId, date: input.date, studentId: s.studentId },
        {
          $set: { status: s.status === "absent" ? "absent" : "present" },
          $setOnInsert: { classId: input.classId, date: input.date, studentId: s.studentId },
        },
        { upsert: true }
      );
    }
  }

  let smsSent = 0;
  // Attendance SMS is OFF by default per tenant (cost control).
  if (tenant.attendanceSmsEnabled) {
    const messages = statuses
      .map((s) => {
        const stu = studentMap.get(s.studentId);
        if (!stu?.phone) return null;
        const body =
          s.status === "absent"
            ? smsTemplates.attendanceAbsent({
                centerName: tenant.name,
                studentName: stu.name,
                date: input.date,
              })
            : smsTemplates.attendancePresent({
                centerName: tenant.name,
                studentName: stu.name,
                date: input.date,
              });
        const kind: SmsKind =
          s.status === "absent" ? "attendance_absent" : "attendance_present";
        return { to: stu.phone, body, studentId: s.studentId, kind };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const res = await sendSmsBatch(tenant.id, messages);
    smsSent = res.sent;
  }

  revalidatePath("/admin/attendance");
  return { ok: true, smsSent };
}

export async function saveAttendance(input: AttendanceInput): Promise<SaveResult> {
  return persistAndNotify(input, false);
}

export async function resendAttendanceSms(
  classId: string,
  date: string
): Promise<SaveResult> {
  return persistAndNotify({ classId, date, statuses: [] }, true);
}
