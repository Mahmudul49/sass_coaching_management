"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  getDueReportPaged,
  getDueReportAll,
  type DuePage,
  type DueReportAll,
} from "@/lib/admin/queries";

type DueFilter = { classId?: string; from: string; to: string; status?: string };

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
