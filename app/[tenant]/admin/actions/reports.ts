"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  getDueReportPaged,
  getDueReportSummary,
  getDueReportAll,
  getAttendanceReport,
  listClasses,
  type DuePage,
  type DueSummary,
  type DueReportAll,
  type AttendanceReportRow,
} from "@/lib/admin/queries";

type DueFilter = { classId?: string; from: string; to: string; status?: string };

export type AttendanceReportResult = {
  rows: AttendanceReportRow[];
  days: number;
  className: string;
};

/**
 * Apply the attendance-report filters (class / from / to) WITHOUT a page
 * navigation. Returns the per-student summary rows, the number of class days in
 * range, and the class name — mirroring the server render in reports/page.tsx so
 * the client can swap filters in place (no router.push / no reload).
 */
export async function loadAttendanceReport(
  classId: string,
  from: string,
  to: string
): Promise<AttendanceReportResult> {
  const { db } = await requireAdminFromRequest();
  const [{ rows, days }, classes] = await Promise.all([
    getAttendanceReport(db, { classId, from, to }),
    listClasses(db),
  ]);
  const className = classes.find((c) => c.id === classId)?.name ?? "";
  return { rows, days, className };
}

export type DueReportResult = { page: DuePage; summary: DueSummary };

/**
 * Apply the report filters WITHOUT a page navigation: returns the first page of
 * rows plus the summary totals for a filter in one round-trip. The client swaps
 * From/To/Class/Status in place and re-renders from this (no router.push / no
 * reload), mirroring the server render in reports/page.tsx.
 */
export async function loadDueReport(filter: DueFilter): Promise<DueReportResult> {
  const { db } = await requireAdminFromRequest();
  const [page, summary] = await Promise.all([
    getDueReportPaged(db, filter),
    getDueReportSummary(db, filter),
  ]);
  return { page, summary };
}

/** Cursor "load more" for the paginated due report (tenant-scoped). */
export async function loadDueReportPage(filter: DueFilter, cursor: string | null): Promise<DuePage> {
  const { db } = await requireAdminFromRequest();
  return getDueReportPaged(db, filter, { cursor, limit: 40 });
}

/**
 * Full row set for Excel export / matrix pivot, built server-side in batches with
 * a hard cap. The client only requests this on an explicit action (download or
 * switching to the matrix view), never on page load.
 */
export async function loadDueReportAll(filter: DueFilter): Promise<DueReportAll> {
  const { db } = await requireAdminFromRequest();
  return getDueReportAll(db, filter);
}
