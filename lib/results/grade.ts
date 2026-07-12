/**
 * Result computation engine (pure, side-effect free, fully unit-testable).
 *
 * Given an exam's config (per-subject total / pass marks), a student's obtained
 * marks and the tenant's grading settings, derive everything shown on the
 * Results screen and certificates: per-subject pass/fail, overall total,
 * percentage, GPA, letter grade and overall pass/fail.
 *
 * This is a READ-time computation (like `lib/fees/allocate.ts`) — no derived
 * value is ever stored, so editing a mark or a grading band recalculates
 * instantly. Same logic feeds Mark Entry preview, Results, Certificates and
 * Reports so they can never diverge.
 */
import type { GradeBand, MarkEntry, PassRule } from "@/lib/db/collections";

/** Bangladesh-standard defaults, used when a tenant hasn't customised settings. */
export const DEFAULT_GRADING_SCALE: GradeBand[] = [
  { grade: "A+", minPct: 80, point: 5 },
  { grade: "A", minPct: 70, point: 4 },
  { grade: "A-", minPct: 60, point: 3.5 },
  { grade: "B", minPct: 50, point: 3 },
  { grade: "C", minPct: 40, point: 2 },
  { grade: "D", minPct: 33, point: 1 },
  { grade: "F", minPct: 0, point: 0 },
];

export const DEFAULT_EXAM_TYPES = [
  "Class Test",
  "Weekly Test",
  "Monthly Test",
  "Model Test",
  "Half Yearly",
  "Annual",
];

export const DEFAULT_TOTAL_MARKS = 100;
export const DEFAULT_PASS_MARKS = 33;

export type SubjectResult = {
  subjectId: string;
  obtained: number | null; // null = not entered / absent
  passed: boolean;
  invalid: boolean; // obtained out of range (< 0 or > total) — flagged, never blocks
};

export type StudentResult = {
  subjects: SubjectResult[];
  entered: number; // subjects with a mark entered
  expected: number; // subjects in the exam
  total: number; // Σ obtained (nulls counted as 0)
  fullTotal: number; // subjectCount * totalMarks
  percentage: number; // total / fullTotal * 100 (0 when fullTotal is 0)
  grade: string;
  point: number; // GPA point for the grade
  passed: boolean;
  complete: boolean; // every subject has a mark
};

export type ExamGradingConfig = {
  totalMarks: number; // per subject
  passMarks: number; // per subject
  subjectIds: string[];
  passRule: PassRule;
  gradingScale: GradeBand[];
};

/** Pick the grading band for a percentage (bands sorted highest-min first). */
function bandFor(pct: number, scale: GradeBand[]): GradeBand {
  const sorted = [...scale].sort((a, b) => b.minPct - a.minPct);
  for (const band of sorted) if (pct >= band.minPct) return band;
  // Fall back to the lowest band (fail) if nothing matched.
  return sorted[sorted.length - 1] ?? { grade: "F", minPct: 0, point: 0 };
}

/** The fail band = the lowest-min band in the scale (its grade, e.g. "F"). */
export function failGrade(scale: GradeBand[]): GradeBand {
  const sorted = [...scale].sort((a, b) => a.minPct - b.minPct);
  return sorted[0] ?? { grade: "F", minPct: 0, point: 0 };
}

/** Public: the grade band a percentage earns (used per-subject on transcripts). */
export function gradeForPercent(pct: number, scale: GradeBand[]): GradeBand {
  return bandFor(pct, scale);
}

/**
 * Build the "marks range" rows shown in a transcript's grading key, e.g.
 * `80-100 A+ 5.00`, `70-79 A 4.00`, … Ranges are derived from consecutive band
 * minimums (top band runs to 100, lowest band starts at 0).
 */
export function gradingRanges(scale: GradeBand[]): { range: string; grade: string; point: number }[] {
  const sorted = [...scale].sort((a, b) => b.minPct - a.minPct);
  return sorted.map((b, i) => {
    const hi = i === 0 ? 100 : Math.max(b.minPct, sorted[i - 1].minPct - 1);
    return { range: `${b.minPct}-${hi}`, grade: b.grade, point: b.point };
  });
}

/**
 * Compute a single student's result from their subject entries and the exam
 * config. Absent/blank subjects count as 0 toward the total. A failed student
 * (per the pass rule) is forced to the fail grade regardless of percentage.
 */
export function computeStudentResult(
  entries: MarkEntry[],
  cfg: ExamGradingConfig
): StudentResult {
  const total = Math.max(0, Number(cfg.totalMarks) || 0);
  const pass = Math.max(0, Number(cfg.passMarks) || 0);
  const byId = new Map(entries.map((e) => [e.subjectId, e]));

  const subjects: SubjectResult[] = cfg.subjectIds.map((subjectId) => {
    const raw = byId.get(subjectId)?.obtained;
    const obtained = raw === null || raw === undefined ? null : Number(raw);
    const invalid = obtained !== null && (obtained < 0 || obtained > total);
    const effective = obtained === null ? 0 : Math.max(0, obtained);
    return { subjectId, obtained, passed: effective >= pass && obtained !== null, invalid };
  });

  const entered = subjects.filter((s) => s.obtained !== null).length;
  const sum = subjects.reduce((acc, s) => acc + (s.obtained === null ? 0 : Math.max(0, s.obtained)), 0);
  const fullTotal = cfg.subjectIds.length * total;
  const percentage = fullTotal > 0 ? (sum / fullTotal) * 100 : 0;

  // Pass rule: per_subject = must pass every subject; overall = aggregate % must
  // reach the pass threshold (passMarks as a % of totalMarks).
  const everySubjectPassed = subjects.every((s) => s.passed);
  const overallPassed = total > 0 ? percentage >= (pass / total) * 100 : false;
  const passed = cfg.passRule === "overall" ? overallPassed : everySubjectPassed;

  const band = passed ? bandFor(percentage, cfg.gradingScale) : failGrade(cfg.gradingScale);

  return {
    subjects,
    entered,
    expected: cfg.subjectIds.length,
    total: sum,
    fullTotal,
    percentage: Math.round(percentage * 100) / 100,
    grade: band.grade,
    point: band.point,
    passed,
    complete: entered === cfg.subjectIds.length && cfg.subjectIds.length > 0,
  };
}
