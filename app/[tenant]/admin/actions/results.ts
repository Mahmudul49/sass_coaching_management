"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  Collections,
  type SubjectDoc,
  type ExamDoc,
  type MarkDoc,
  type MarkEntry,
  type GradeBand,
  type PassRule,
  type SmsKind,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { sendSmsBatch } from "@/lib/sms";
import { smsTemplates } from "@/lib/sms/templates";
import { revalidateTenantAdminLayout } from "@/lib/tenant/revalidate";
import {
  getExam,
  computeExamResults,
  getResultsReport,
  type ResultRow,
  type ResultReport,
} from "@/lib/results/queries";
import { getExamSettings, sanitizeSettings, type ExamSettings } from "@/lib/results/settings";
import type { AnyBulkWriteOperation } from "mongodb";

export type ActionResult = { ok: boolean; error?: string };
const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

/* ───────────────────────── Subjects (master data) ───────────────────────── */

export async function createSubject(classId: string, name: string, order?: number): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const n = name?.trim();
  if (!classId) return fail("Please select a class.");
  if (!n) return fail("Please enter a subject name.");
  const cls = await db.collection(Collections.classes).findOne({ _id: toObjectId(classId)! } as never);
  if (!cls) return fail("Class not found.");
  const dup = await db.collection(Collections.subjects).findOne({ classId, name: n });
  if (dup) return fail("This subject already exists.");
  await db.collection(Collections.subjects).insertOne({ classId, name: n, order: order ?? 0 } as never);
  await revalidateTenantAdminLayout();
  return ok;
}

export async function updateSubject(id: string, name: string, order: number): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("Invalid id.");
  const n = name?.trim();
  if (!n) return fail("Please enter a subject name.");
  await db
    .collection(Collections.subjects)
    .updateOne({ _id } as never, { $set: { name: n, order: order ?? 0 } });
  await revalidateTenantAdminLayout();
  return ok;
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("Invalid id.");
  // Block deletion if any exam still references this subject.
  const used = await db.collection(Collections.exams).countDocuments({ subjectIds: id });
  if (used > 0) return fail("This subject is used by an exam — remove it there first.");
  await db.collection(Collections.subjects).deleteOne({ _id } as never);
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Exam setup ───────────────────────── */

export type CreateExamInput = {
  classId: string;
  name: string;
  examType: string;
  date: string; // YYYY-MM-DD
  totalMarks: number;
  passMarks: number;
  subjectIds: string[];
};
export type CreateExamResult = { ok: boolean; error?: string; examId?: string };

export async function createExam(input: CreateExamInput): Promise<CreateExamResult> {
  const { db } = await requireAdminFromRequest();
  const name = input.name?.trim();
  if (!input.classId) return { ok: false, error: "Please select a class." };
  if (!name) return { ok: false, error: "Please enter an exam name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Please pick a valid date." };

  const cls = await db.collection(Collections.classes).findOne({ _id: toObjectId(input.classId)! } as never);
  if (!cls) return { ok: false, error: "Class not found." };

  // Keep only subjectIds that really belong to this class (never trust the client).
  const classSubjects = (await db
    .collection<SubjectDoc>(Collections.subjects)
    .findArray({ classId: input.classId }, { projection: { _id: 1 } })) as SubjectDoc[];
  const valid = new Set(classSubjects.map((s) => s._id.toString()));
  const subjectIds = (input.subjectIds ?? []).filter((id) => valid.has(id));
  if (subjectIds.length === 0) return { ok: false, error: "Please select at least one subject." };

  const total = Math.max(1, Math.round(Number(input.totalMarks) || 0));
  const pass = Math.min(total, Math.max(0, Math.round(Number(input.passMarks) || 0)));

  const res = await db.collection<ExamDoc>(Collections.exams).insertOne({
    classId: input.classId,
    name,
    examType: String(input.examType ?? "").trim() || "Exam",
    date: input.date,
    totalMarks: total,
    passMarks: pass,
    subjectIds,
    status: "draft",
    createdAt: new Date(),
    publishedAt: null,
  } as never);

  await revalidateTenantAdminLayout();
  return { ok: true, examId: res.insertedId.toString() };
}

/**
 * Delete an exam and all its marks. Allowed even after publishing (the admin can
 * remove a published result); this also clears the whole mark set for the exam.
 */
export async function deleteExam(examId: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(examId);
  if (!_id) return fail("Invalid id.");
  const exam = (await db.collection<ExamDoc>(Collections.exams).findOne({ _id } as never)) as ExamDoc | null;
  if (!exam) return fail("Exam not found.");
  await db.collection(Collections.exams).deleteOne({ _id } as never);
  await db.collection(Collections.marks).deleteMany({ examId });
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Mark entry (bulk upsert) ───────────────────────── */

export type SaveMarksInput = { studentId: string; entries: MarkEntry[] };
export type SaveMarksResult = { ok: boolean; saved: number; failed: number; error?: string };

/**
 * Save the whole class's marks for an exam in ONE request — the same batched
 * `bulkWrite` pattern as `savePaymentsBulk` (one auth, one student `$in`, one
 * bulk upsert, one revalidate). Never one write per keystroke. Published exams
 * are locked (results already sent), so marks can only be edited while draft.
 */
export async function saveMarksBulk(
  examId: string,
  inputs: SaveMarksInput[]
): Promise<SaveMarksResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(examId);
  if (!_id) return { ok: false, saved: 0, failed: 0, error: "Invalid exam." };
  const exam = (await db.collection<ExamDoc>(Collections.exams).findOne({ _id } as never)) as ExamDoc | null;
  if (!exam) return { ok: false, saved: 0, failed: 0, error: "Exam not found." };
  if (exam.status === "published")
    return { ok: false, saved: 0, failed: 0, error: "Results are published and locked." };
  if (!inputs?.length) return { ok: true, saved: 0, failed: 0 };

  const allowed = new Set(exam.subjectIds ?? []);
  const now = new Date();
  const ops: AnyBulkWriteOperation<MarkDoc>[] = [];

  for (const input of inputs) {
    if (!input.studentId) continue;
    // Sanitise entries: only this exam's subjects, marks clamped to [0, total],
    // null preserved (blank / not entered).
    const entries: MarkEntry[] = (input.entries ?? [])
      .filter((e) => allowed.has(e.subjectId))
      .map((e) => {
        if (e.obtained === null || e.obtained === undefined || e.obtained === ("" as never)) {
          return { subjectId: e.subjectId, obtained: null };
        }
        const v = Math.max(0, Math.min(exam.totalMarks, Number(e.obtained) || 0));
        return { subjectId: e.subjectId, obtained: v };
      });
    ops.push({
      updateOne: {
        filter: { examId, studentId: input.studentId } as never,
        update: {
          $set: { classId: exam.classId, entries, updatedAt: now },
          $setOnInsert: { examId, studentId: input.studentId },
        } as never,
        upsert: true,
      },
    });
  }

  let saved = 0;
  let failed = 0;
  let error: string | undefined;
  if (ops.length) {
    try {
      const res = await db.collection<MarkDoc>(Collections.marks).bulkWrite(ops, { ordered: false });
      saved = (res.upsertedCount ?? 0) + (res.matchedCount ?? 0);
      failed = ops.length - saved;
    } catch (err) {
      const r = (err as { result?: { nUpserted?: number; nMatched?: number } }).result;
      saved = r ? (r.nUpserted ?? 0) + (r.nMatched ?? 0) : 0;
      failed = ops.length - saved;
      error = "Some marks could not be saved. Please try again.";
    }
  }
  await revalidateTenantAdminLayout();
  return { ok: failed === 0, saved, failed, error };
}

/* ───────────────────────── Publish (batch notify) ───────────────────────── */

export type PublishResult = { ok: boolean; error?: string; notified?: number };

/**
 * Publish an exam's results (draft → published, one-way). If notify-on-publish is
 * on, guardians are texted in ONE batch (`sendSmsBatch`) — never a per-student
 * loop — after the status commit, so SMS failure can't fail the publish.
 */
export async function publishExam(examId: string): Promise<PublishResult> {
  const { db, tenant } = await requireAdminFromRequest();
  const _id = toObjectId(examId);
  if (!_id) return { ok: false, error: "Invalid id." };
  const examDoc = (await db.collection<ExamDoc>(Collections.exams).findOne({ _id } as never)) as ExamDoc | null;
  if (!examDoc) return { ok: false, error: "Exam not found." };
  if (examDoc.status === "published") return { ok: false, error: "Already published." };

  await db
    .collection(Collections.exams)
    .updateOne({ _id } as never, { $set: { status: "published", publishedAt: new Date() } });
  await revalidateTenantAdminLayout();

  let notified = 0;
  const settings = await getExamSettings(db);
  if (settings.notifyOnPublish) {
    try {
      const exam = await getExam(db, examId);
      if (exam) {
        const { rows } = await computeExamResults(db, exam);
        const messages = rows
          .filter((r) => r.phone)
          .map((r) => ({
            to: r.phone,
            studentId: r.id,
            kind: "result_published" as SmsKind,
            body: smsTemplates.resultPublished({
              centerName: tenant.name,
              studentName: r.name,
              examName: exam.name,
              gpa: String(r.result.point),
              result: r.result.passed ? "উত্তীর্ণ" : "অনুত্তীর্ণ",
            }),
          }));
        if (messages.length) notified = (await sendSmsBatch(tenant.id, messages)).sent;
      }
    } catch {
      // Publish already committed — SMS is best-effort.
    }
  }
  return { ok: true, notified };
}

/* ───────────────────────── Settings ───────────────────────── */

export type SaveExamSettingsInput = {
  gradingScale: GradeBand[];
  passRule: PassRule;
  defaultTotalMarks: number;
  defaultPassMarks: number;
  examTypes: string[];
  certificateTitle: string;
  notifyOnPublish: boolean;
};

export async function saveExamSettings(input: SaveExamSettingsInput): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const clean: ExamSettings = sanitizeSettings({ ...input, scope: "exam" } as never);
  await db.collection(Collections.examSettings).updateOne(
    { scope: "exam" },
    {
      $set: {
        gradingScale: clean.gradingScale,
        passRule: clean.passRule,
        defaultTotalMarks: clean.defaultTotalMarks,
        defaultPassMarks: clean.defaultPassMarks,
        examTypes: clean.examTypes,
        certificateTitle: clean.certificateTitle,
        notifyOnPublish: clean.notifyOnPublish,
        updatedAt: new Date(),
      },
      $setOnInsert: { scope: "exam" },
    },
    { upsert: true }
  );
  await revalidateTenantAdminLayout();
  return ok;
}

/* ───────────────────────── Reports (in-place filter) ───────────────────────── */

export type ReportFilter = {
  classId?: string;
  examId?: string;
  from?: string;
  to?: string;
  subjectId?: string;
  status?: "draft" | "published" | "all";
};

/** Fetch the results report for a filter WITHOUT a page navigation — the client
 *  swaps filters in place and re-renders from this (same idea as loadPaymentRows). */
export async function loadResultsReport(filter: ReportFilter): Promise<ResultReport> {
  const { db } = await requireAdminFromRequest();
  return getResultsReport(db, filter);
}

// Re-export the row type used by clients that call the compute action indirectly.
export type { ResultRow };
