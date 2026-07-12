import "server-only";
import type { Db } from "mongodb";
import { getClient, dbName } from "@/lib/db/connect";
import { Collections } from "@/lib/db/collections";

/**
 * CLEAN CENTER DATA — irreversibly wipe one tenant's OPERATIONAL data while
 * preserving the tenant profile and its admin account (login/roles/auth).
 *
 * Only these tenant-scoped operational collections are cleared. `tenants` and
 * `users` are DELIBERATELY excluded so the admin keeps their account and can log
 * in to a fresh database. `themeSettings`/`auditLog` are platform-level and never
 * touched. Everything runs inside a multi-document transaction (Atlas replica
 * set), so any failure rolls the whole thing back — it's all-or-nothing.
 */
const CLEANABLE_COLLECTIONS = [
  Collections.students,
  Collections.classes,
  Collections.sections,
  Collections.feeStructure,
  Collections.feeOverride,
  Collections.attendance,
  Collections.payments,
  Collections.smsLog,
  Collections.conversations,
  Collections.messages,
] as const;

export type CleanResult = {
  ok: boolean;
  deleted: Record<string, number>;
  total: number;
  error?: string;
};

export async function runCleanCenterData(
  tenant: { id: string; slug: string; name: string },
  actor: { id: string; name: string }
): Promise<CleanResult> {
  const client = await getClient();
  const db = client.db(dbName);
  const session = client.startSession();
  const deleted: Record<string, number> = {};

  try {
    await session.withTransaction(async () => {
      // withTransaction may re-run this body on a transient error; reset counts so
      // a retry never double-counts.
      for (const k of Object.keys(deleted)) delete deleted[k];
      for (const name of CLEANABLE_COLLECTIONS) {
        const res = await db.collection(name).deleteMany({ tenantId: tenant.id }, { session });
        deleted[name] = res.deletedCount ?? 0;
      }
    });
  } catch (err) {
    await session.endSession();
    await writeAudit(db, tenant, actor, "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      deleted: {},
      total: 0,
      error: "The cleanup failed and was rolled back — no data was deleted. Please try again.",
    };
  }
  await session.endSession();

  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  // Audit AFTER commit so the record reflects the durable outcome.
  await writeAudit(db, tenant, actor, "success", { deleted, total });
  return { ok: true, deleted, total };
}

async function writeAudit(
  db: Db,
  tenant: { id: string; slug: string; name: string },
  actor: { id: string; name: string },
  status: "success" | "failed",
  details: Record<string, unknown>
): Promise<void> {
  try {
    await db.collection(Collections.auditLog).insertOne({
      action: "clean_center_data",
      actorId: actor.id,
      actorName: actor.name,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      status,
      details,
      createdAt: new Date(),
    });
  } catch (e) {
    // Never let an audit-write failure mask the operation's real outcome.
    console.error("audit log write failed:", e);
  }
}
