import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import {
  Collections,
  type SubjectDoc,
  type ExamDoc,
  type MarkDoc,
  type StudentDoc,
  type MarkEntry,
} from "@/lib/db/collections";
import { listClasses, listSections } from "@/lib/admin/queries";
import { getExamSettings } from "@/lib/results/settings";
import {
  computeStudentResult,
  gradeForPercent,
  gradingRanges,
  type StudentResult,
} from "@/lib/results/grade";
import { toObjectId } from "@/lib/db/oid";

/**
 * Results read models. Every function is `(db: ScopedDb, …) → plain rows` and
 * batch-fetches (one `$in`, `Map` joins) — no N+1 — with lean projections and
 * cursor pagination on the large paths, mirroring `lib/admin/queries.ts`.
 * Derived figures (total/%/grade/pass) are computed on read via `grade.ts`.
 */

/* ───────────────────────── Subjects ───────────────────────── */

export type SubjectRow = { id: string; classId: string; className: string; name: string; order: number };

export async function listSubjects(db: ScopedDb, classId?: string): Promise<SubjectRow[]> {
  const [classes, docs] = await Promise.all([
    listClasses(db),
    db
      .collection<SubjectDoc>(Collections.subjects)
      .findArray(classId ? { classId } : {}, { sort: { order: 1, name: 1 } }) as Promise<SubjectDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  return docs.map((s) => ({
    id: s._id.toString(),
    classId: s.classId,
    className: classMap.get(s.classId) ?? "—",
    name: s.name,
    order: s.order ?? 0,
  }));
}

/* ───────────────────────── Exams ───────────────────────── */

export type ExamRow = {
  id: string;
  classId: string;
  className: string;
  name: string;
  examType: string;
  date: string;
  totalMarks: number;
  passMarks: number;
  subjectIds: string[];
  subjectCount: number;
  status: "draft" | "published";
  createdAt: string;
  publishedAt: string | null;
};

function mapExam(e: ExamDoc, classMap: Map<string, string>): ExamRow {
  return {
    id: e._id.toString(),
    classId: e.classId,
    className: classMap.get(e.classId) ?? "—",
    name: e.name,
    examType: e.examType,
    date: e.date,
    totalMarks: e.totalMarks,
    passMarks: e.passMarks,
    subjectIds: e.subjectIds ?? [],
    subjectCount: (e.subjectIds ?? []).length,
    status: e.status,
    createdAt: e.createdAt?.toISOString?.() ?? "",
    publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
  };
}

/** List exams (optionally filtered), newest first. Bounded by `limit`. */
export async function listExams(
  db: ScopedDb,
  filter: { classId?: string; status?: "draft" | "published" } = {},
  limit = 100
): Promise<ExamRow[]> {
  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (filter.status) q.status = filter.status;
  const [classes, docs] = await Promise.all([
    listClasses(db),
    db
      .collection<ExamDoc>(Collections.exams)
      .findArray(q, { sort: { date: -1, _id: -1 }, limit }) as Promise<ExamDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  return docs.map((e) => mapExam(e, classMap));
}

/** A single exam by id (tenant-scoped). */
export async function getExam(db: ScopedDb, examId: string): Promise<ExamRow | null> {
  const oid = toObjectId(examId);
  if (!oid) return null;
  const doc = (await db.collection<ExamDoc>(Collections.exams).findOne({ _id: oid } as never)) as ExamDoc | null;
  if (!doc) return null;
  const classes = await listClasses(db);
  return mapExam(doc, new Map(classes.map((c) => [c.id, c.name])));
}

/* ───────────────────────── Mark entry grid ───────────────────────── */

export type MarkEntryRow = {
  id: string; // studentId
  name: string;
  roll: string;
  sectionName: string;
  phone: string;
  marks: Record<string, number | null>; // subjectId -> obtained (null = blank)
};

/** Load the mark-entry grid for an exam: exam config, subject columns, one row
 *  per active student pre-filled with any saved marks. One `$in` marks fetch. */
export async function buildMarkEntry(
  db: ScopedDb,
  exam: ExamRow
): Promise<{ subjects: SubjectRow[]; rows: MarkEntryRow[] }> {
  const [subjects, students, sections, markDocs] = await Promise.all([
    listSubjects(db, exam.classId),
    db.collection<StudentDoc>(Collections.students).findArray(
      { classId: exam.classId, active: true },
      { sort: { roll: 1 }, projection: { name: 1, roll: 1, sectionId: 1, phone: 1 } }
    ) as Promise<StudentDoc[]>,
    listSections(db),
    db.collection<MarkDoc>(Collections.marks).findArray({ examId: exam.id }) as Promise<MarkDoc[]>,
  ]);
  const examSubjects = subjects.filter((s) => exam.subjectIds.includes(s.id));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const markByStudent = new Map(markDocs.map((m) => [m.studentId, m]));

  const rows: MarkEntryRow[] = students.map((s) => {
    const id = s._id.toString();
    const saved = markByStudent.get(id);
    const entryMap = new Map((saved?.entries ?? []).map((e) => [e.subjectId, e.obtained]));
    const marks: Record<string, number | null> = {};
    for (const sub of examSubjects) marks[sub.id] = entryMap.has(sub.id) ? entryMap.get(sub.id)! : null;
    return {
      id,
      name: s.name,
      roll: s.roll,
      sectionName: sectionMap.get(s.sectionId) ?? "—",
      phone: s.phone ?? "",
      marks,
    };
  });
  return { subjects: examSubjects, rows };
}

/* ───────────────────────── Computed results ───────────────────────── */

export type ResultRow = {
  id: string; // studentId
  name: string;
  roll: string;
  sectionName: string;
  phone: string;
  result: StudentResult;
};

/**
 * Compute every active student's result for an exam (shared by Results,
 * Certificates and Reports). Bounded to one exam — one `$in` marks fetch, then
 * pure per-student computation via `grade.ts`.
 */
export async function computeExamResults(
  db: ScopedDb,
  exam: ExamRow
): Promise<{ subjects: SubjectRow[]; rows: ResultRow[] }> {
  const [settings, subjects, students, sections, markDocs] = await Promise.all([
    getExamSettings(db),
    listSubjects(db, exam.classId),
    db.collection<StudentDoc>(Collections.students).findArray(
      { classId: exam.classId, active: true },
      { sort: { roll: 1 }, projection: { name: 1, roll: 1, sectionId: 1, phone: 1 } }
    ) as Promise<StudentDoc[]>,
    listSections(db),
    db.collection<MarkDoc>(Collections.marks).findArray({ examId: exam.id }) as Promise<MarkDoc[]>,
  ]);
  const examSubjects = subjects.filter((s) => exam.subjectIds.includes(s.id));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const markByStudent = new Map(markDocs.map((m) => [m.studentId, m]));

  const cfg = {
    totalMarks: exam.totalMarks,
    passMarks: exam.passMarks,
    subjectIds: examSubjects.map((s) => s.id),
    passRule: settings.passRule,
    gradingScale: settings.gradingScale,
  };

  const rows: ResultRow[] = students.map((s) => {
    const id = s._id.toString();
    const entries: MarkEntry[] = markByStudent.get(id)?.entries ?? [];
    return {
      id,
      name: s.name,
      roll: s.roll,
      sectionName: sectionMap.get(s.sectionId) ?? "—",
      phone: s.phone ?? "",
      result: computeStudentResult(entries, cfg),
    };
  });

  // Rank by total desc for the results table (position column).
  rows.sort((a, b) => b.result.total - a.result.total || a.roll.localeCompare(b.roll));
  return { subjects: examSubjects, rows };
}

/* ───────────────────────── Dashboard ───────────────────────── */

export type ResultsDashboard = {
  drafts: number; // exams in progress
  pendingMarks: number; // draft exams still missing marks
  awaitingPublish: number; // draft exams with all marks entered
  recentPublished: ExamRow[];
};

/**
 * Aggregated dashboard status. Light and bounded: only DRAFT exams are inspected
 * for completeness (there are few of them), via one grouped marks count and the
 * per-class active-student counts — never a per-student scan.
 */
export async function getResultsDashboard(db: ScopedDb): Promise<ResultsDashboard> {
  const classes = await listClasses(db);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  const [draftDocs, publishedDocs, activeCounts] = await Promise.all([
    db.collection<ExamDoc>(Collections.exams).findArray({ status: "draft" }, { sort: { date: -1 } }) as Promise<ExamDoc[]>,
    db.collection<ExamDoc>(Collections.exams).findArray({ status: "published" }, { sort: { publishedAt: -1 }, limit: 5 }) as Promise<ExamDoc[]>,
    db
      .collection<StudentDoc>(Collections.students)
      .aggregate<{ _id: string; n: number }>([
        { $match: { active: true } },
        { $group: { _id: "$classId", n: { $sum: 1 } } },
      ])
      .then((c) => c.toArray()),
  ]);
  const studentsByClass = new Map(activeCounts.map((r) => [r._id, r.n]));

  // Marks entered per draft exam (one grouped count over just the draft ids).
  const draftIds = draftDocs.map((e) => e._id.toString());
  const marksByExam = new Map<string, number>();
  if (draftIds.length) {
    const grouped = await (
      await db
        .collection<MarkDoc>(Collections.marks)
        .aggregate<{ _id: string; n: number }>([
          { $match: { examId: { $in: draftIds } } },
          { $group: { _id: "$examId", n: { $sum: 1 } } },
        ])
    ).toArray();
    for (const g of grouped) marksByExam.set(g._id, g.n);
  }

  let pendingMarks = 0;
  let awaitingPublish = 0;
  for (const e of draftDocs) {
    const need = studentsByClass.get(e.classId) ?? 0;
    const have = marksByExam.get(e._id.toString()) ?? 0;
    if (need > 0 && have >= need) awaitingPublish++;
    else pendingMarks++;
  }

  return {
    drafts: draftDocs.length,
    pendingMarks,
    awaitingPublish,
    recentPublished: publishedDocs.map((e) => mapExam(e, classMap)),
  };
}

/* ───────────────────────── Reports (computed-on-read) ───────────────────────── */

export type ResultReportRow = {
  id: string; // examId:studentId
  examId: string;
  examName: string;
  examDate: string;
  className: string;
  studentName: string;
  roll: string;
  sectionName: string;
  subjectMark: number | null; // populated only when a subject filter is applied
  total: number;
  fullTotal: number;
  percentage: number;
  grade: string;
  passed: boolean;
};

export type ResultReport = { rows: ResultReportRow[]; capped: boolean };

/**
 * Cross-exam results report (computed-on-read, capped). Loads shared master data
 * (settings/classes/sections/subjects) ONCE, then loops the matching exams —
 * students are fetched per class and memoised, marks per exam in one `$in`, so we
 * avoid the naive N+1 of recomputing everything per exam. Hard-capped so a wide
 * date range can't exhaust memory; `capped` warns the client when truncated.
 */
export async function getResultsReport(
  db: ScopedDb,
  filter: { classId?: string; examId?: string; from?: string; to?: string; subjectId?: string; status?: "draft" | "published" | "all" },
  cap = 5000
): Promise<ResultReport> {
  const q: Record<string, unknown> = {};
  if (filter.classId) q.classId = filter.classId;
  if (filter.examId) {
    const oid = toObjectId(filter.examId);
    if (oid) q._id = oid;
  }
  if (filter.status && filter.status !== "all") q.status = filter.status;
  if (filter.from || filter.to) {
    const range: Record<string, string> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    q.date = range;
  }

  const [settings, classes, sections, subjects, exams] = await Promise.all([
    getExamSettings(db),
    listClasses(db),
    listSections(db),
    db.collection<SubjectDoc>(Collections.subjects).findArray({}) as Promise<SubjectDoc[]>,
    db.collection<ExamDoc>(Collections.exams).findArray(q, { sort: { date: -1, _id: -1 } }) as Promise<ExamDoc[]>,
  ]);
  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const subjectOrder = new Map(subjects.map((s) => [s._id.toString(), s.order ?? 0]));

  // Memoise a class's active students so several exams of the same class don't refetch.
  const studentsCache = new Map<string, StudentDoc[]>();
  async function studentsOf(classId: string): Promise<StudentDoc[]> {
    const hit = studentsCache.get(classId);
    if (hit) return hit;
    const docs = (await db.collection<StudentDoc>(Collections.students).findArray(
      { classId, active: true },
      { sort: { roll: 1 }, projection: { name: 1, roll: 1, sectionId: 1 } }
    )) as StudentDoc[];
    studentsCache.set(classId, docs);
    return docs;
  }

  const rows: ResultReportRow[] = [];
  let capped = false;
  for (const e of exams) {
    if (filter.subjectId && !(e.subjectIds ?? []).includes(filter.subjectId)) continue;
    const examId = e._id.toString();
    const [students, markDocs] = await Promise.all([
      studentsOf(e.classId),
      db.collection<MarkDoc>(Collections.marks).findArray({ examId }) as Promise<MarkDoc[]>,
    ]);
    const markByStudent = new Map(markDocs.map((m) => [m.studentId, m]));
    const orderedSubjectIds = [...(e.subjectIds ?? [])].sort(
      (a, b) => (subjectOrder.get(a) ?? 0) - (subjectOrder.get(b) ?? 0)
    );
    const cfg = {
      totalMarks: e.totalMarks,
      passMarks: e.passMarks,
      subjectIds: orderedSubjectIds,
      passRule: settings.passRule,
      gradingScale: settings.gradingScale,
    };
    for (const s of students) {
      const sid = s._id.toString();
      const entries = markByStudent.get(sid)?.entries ?? [];
      const r = computeStudentResult(entries, cfg);
      const subjectMark = filter.subjectId
        ? entries.find((en) => en.subjectId === filter.subjectId)?.obtained ?? null
        : null;
      rows.push({
        id: `${examId}:${sid}`,
        examId,
        examName: e.name,
        examDate: e.date,
        className: classMap.get(e.classId) ?? "—",
        studentName: s.name,
        roll: s.roll,
        sectionName: sectionMap.get(s.sectionId) ?? "—",
        subjectMark,
        total: r.total,
        fullTotal: r.fullTotal,
        percentage: r.percentage,
        grade: r.grade,
        passed: r.passed,
      });
      if (rows.length >= cap) {
        capped = true;
        break;
      }
    }
    if (capped) break;
  }
  return { rows, capped };
}

/* ───────────────────────── Transcripts (academic report card) ───────────────────────── */

export type TranscriptSubject = {
  sl: number;
  name: string;
  fullMarks: number;
  obtained: number; // blank counts as 0
  highest: number; // highest obtained for this subject in the class
  point: number; // per-subject GPA point
  grade: string; // per-subject letter grade
};

export type TranscriptRow = {
  id: string; // studentId
  name: string;
  roll: string;
  className: string;
  sectionName: string;
  subjects: TranscriptSubject[];
  grandTotal: number;
  fullTotal: number;
  percentage: number;
  gpa: number; // 0.00 when failed
  overallGrade: string; // overall letter grade (respects pass/fail)
  passed: boolean;
  rankClass: number; // merit position in the class (also the list order)
  classCount: number;
};

export type Transcripts = {
  grading: { range: string; grade: string; point: number }[];
  rows: TranscriptRow[];
};

/**
 * Build one-page academic transcripts for every active student in an exam.
 * Computes per-subject letter/point, each subject's class-highest, grand total,
 * percentage, GPA, overall grade and merit position in the class — all from a
 * single marks fetch + the class roster (no per-student refetch). Rows are
 * returned in merit order (highest total first). Read-time only; nothing is
 * stored, so a mark edit re-renders the whole transcript instantly.
 */
export async function buildTranscripts(db: ScopedDb, exam: ExamRow): Promise<Transcripts> {
  const [settings, subjects, students, sections, markDocs] = await Promise.all([
    getExamSettings(db),
    listSubjects(db, exam.classId),
    db.collection<StudentDoc>(Collections.students).findArray(
      { classId: exam.classId, active: true },
      { sort: { roll: 1 }, projection: { name: 1, roll: 1, sectionId: 1 } }
    ) as Promise<StudentDoc[]>,
    listSections(db),
    db.collection<MarkDoc>(Collections.marks).findArray({ examId: exam.id }) as Promise<MarkDoc[]>,
  ]);
  const examSubjects = subjects.filter((s) => exam.subjectIds.includes(s.id));
  const sectionMap = new Map(sections.map((s) => [s.id, s.name]));
  const markByStudent = new Map(markDocs.map((m) => [m.studentId, m]));
  const total = exam.totalMarks;
  const passRuleCfg = {
    totalMarks: exam.totalMarks,
    passMarks: exam.passMarks,
    subjectIds: examSubjects.map((s) => s.id),
    passRule: settings.passRule,
    gradingScale: settings.gradingScale,
  };

  // Highest obtained per subject across the class (one pass over marks).
  const highest = new Map<string, number>();
  for (const m of markDocs) {
    for (const e of m.entries) {
      if (e.obtained === null || e.obtained === undefined) continue;
      const cur = highest.get(e.subjectId) ?? 0;
      if (e.obtained > cur) highest.set(e.subjectId, e.obtained);
    }
  }

  const rows: TranscriptRow[] = students.map((s) => {
    const id = s._id.toString();
    const entryMap = new Map((markByStudent.get(id)?.entries ?? []).map((e) => [e.subjectId, e.obtained]));
    const result = computeStudentResult(
      examSubjects.map((sub) => ({ subjectId: sub.id, obtained: entryMap.get(sub.id) ?? null })),
      passRuleCfg
    );
    const subjectRows: TranscriptSubject[] = examSubjects.map((sub, i) => {
      const obtained = Math.max(0, Number(entryMap.get(sub.id) ?? 0) || 0);
      const band = gradeForPercent(total > 0 ? (obtained / total) * 100 : 0, settings.gradingScale);
      return {
        sl: i + 1,
        name: sub.name,
        fullMarks: total,
        obtained,
        highest: highest.get(sub.id) ?? obtained,
        point: band.point,
        grade: band.grade,
      };
    });
    // GPA = average of subject points, but a fail (per the pass rule) shows 0.00.
    const avg = subjectRows.length
      ? subjectRows.reduce((a, r) => a + r.point, 0) / subjectRows.length
      : 0;
    return {
      id,
      name: s.name,
      roll: s.roll,
      className: exam.className,
      sectionName: sectionMap.get(s.sectionId) ?? "—",
      subjects: subjectRows,
      grandTotal: result.total,
      fullTotal: result.fullTotal,
      percentage: result.percentage,
      gpa: result.passed ? Math.round(avg * 100) / 100 : 0,
      overallGrade: result.grade,
      passed: result.passed,
      rankClass: 0,
      classCount: students.length,
    };
  });

  // Merit position: standard competition ranking by grand total. Rows are then
  // returned in that order so the list reads top-to-bottom by rank (position).
  const ranked = [...rows].sort((a, b) => b.grandTotal - a.grandTotal);
  let rank = 0;
  let prev: number | null = null;
  ranked.forEach((r, i) => {
    if (prev === null || r.grandTotal !== prev) rank = i + 1;
    r.rankClass = rank;
    prev = r.grandTotal;
  });

  return { grading: gradingRanges(settings.gradingScale), rows: ranked };
}
