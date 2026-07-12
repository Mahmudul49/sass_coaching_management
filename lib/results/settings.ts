import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import {
  Collections,
  type ExamSettingsDoc,
  type GradeBand,
  type PassRule,
} from "@/lib/db/collections";
import {
  DEFAULT_GRADING_SCALE,
  DEFAULT_EXAM_TYPES,
  DEFAULT_TOTAL_MARKS,
  DEFAULT_PASS_MARKS,
} from "@/lib/results/grade";

/**
 * Results settings access. A single tenant document (`scope: "exam"`) holds the
 * grading scale, pass rule and defaults reused across Exam Setup, Results and
 * Certificates. Reads sanitise a partial/absent doc back to safe defaults so a
 * tenant that never opened Settings still gets a working grading scale (full
 * backward compatibility). Mirrors `lib/superadmin/theme.ts`.
 */

/** Plain, serialisable settings handed to client components. */
export type ExamSettings = {
  gradingScale: GradeBand[];
  passRule: PassRule;
  defaultTotalMarks: number;
  defaultPassMarks: number;
  examTypes: string[];
  certificateTitle: string;
  notifyOnPublish: boolean;
};

export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  gradingScale: DEFAULT_GRADING_SCALE,
  passRule: "per_subject",
  defaultTotalMarks: DEFAULT_TOTAL_MARKS,
  defaultPassMarks: DEFAULT_PASS_MARKS,
  examTypes: DEFAULT_EXAM_TYPES,
  certificateTitle: "Academic Transcript", // used as the transcript heading
  notifyOnPublish: true,
};

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Sanitise a raw settings doc (possibly partial/absent) into safe values. */
export function sanitizeSettings(doc: Partial<ExamSettingsDoc> | null): ExamSettings {
  if (!doc) return DEFAULT_EXAM_SETTINGS;
  const scale = Array.isArray(doc.gradingScale) && doc.gradingScale.length
    ? doc.gradingScale
        .map((b) => ({
          grade: String(b.grade ?? "").trim() || "?",
          minPct: Math.min(100, Math.max(0, num(b.minPct, 0))),
          point: Math.max(0, num(b.point, 0)),
        }))
        .sort((a, b) => b.minPct - a.minPct)
    : DEFAULT_GRADING_SCALE;
  const types = Array.isArray(doc.examTypes) && doc.examTypes.length
    ? doc.examTypes.map((s) => String(s).trim()).filter(Boolean)
    : DEFAULT_EXAM_TYPES;
  return {
    gradingScale: scale,
    passRule: doc.passRule === "overall" ? "overall" : "per_subject",
    defaultTotalMarks: Math.max(1, num(doc.defaultTotalMarks, DEFAULT_TOTAL_MARKS)),
    defaultPassMarks: Math.max(0, num(doc.defaultPassMarks, DEFAULT_PASS_MARKS)),
    examTypes: types,
    certificateTitle:
      String(doc.certificateTitle ?? "").trim() || DEFAULT_EXAM_SETTINGS.certificateTitle,
    notifyOnPublish: doc.notifyOnPublish !== false,
  };
}

/** Load a tenant's Results settings (sanitised, always returns a full object). */
export async function getExamSettings(db: ScopedDb): Promise<ExamSettings> {
  const doc = (await db
    .collection<ExamSettingsDoc>(Collections.examSettings)
    .findOne({ scope: "exam" })) as ExamSettingsDoc | null;
  return sanitizeSettings(doc);
}
