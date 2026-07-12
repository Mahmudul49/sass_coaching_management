import "server-only";
import type { ClientSession, Db } from "mongodb";
import { getClient, dbName } from "@/lib/db/connect";
import { Collections } from "@/lib/db/collections";

/**
 * TENANT DATA COLLECTIONS — every tenant-scoped OPERATIONAL collection (each
 * carries a string `tenantId`). Single source of truth shared by:
 *   • Clean Center Data — wipes these, KEEPS the tenant profile + admin account.
 *   • Delete Center      — wipes these, PLUS the tenant's users and the tenant doc.
 *
 * `themeSettings` (console scope, no tenantId) and `auditLog` (platform trail)
 * are DELIBERATELY excluded — they are platform-level, never per-tenant.
 */
export const TENANT_DATA_COLLECTIONS = [
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
  // Results module — tenant-scoped like the finance collections.
  Collections.subjects,
  Collections.exams,
  Collections.marks,
  Collections.examSettings,
] as const;

export type CleanResult = {
  ok: boolean;
  deleted: Record<string, number>;
  total: number;
  error?: string;
};

/**
 * CLEAN CENTER DATA — irreversibly wipe one tenant's operational data while
 * preserving the tenant profile and its admin account (login/roles/auth), so the
 * admin can start with a fresh database. Runs inside a multi-document transaction
 * (Atlas replica set): any failure rolls the whole thing back — all-or-nothing.
 */
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
      await deleteTenantData(db, tenant.id, session, deleted);
    });
  } catch (err) {
    await session.endSession();
    await writeAudit(db, "clean_center_data", tenant, actor, "failed", {
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
  await writeAudit(db, "clean_center_data", tenant, actor, "success", { deleted, total });
  return { ok: true, deleted, total };
}

/**
 * DELETE CENTER — irreversibly remove a tenant entirely: all operational data,
 * every user belonging to the tenant (the admin + any others), and the tenant
 * document itself. After this the slug is free again and nothing about the center
 * remains except the append-only audit record. All-or-nothing (transaction).
 * Only the target tenant's own `tenantId` is touched, so other tenants are safe.
 */
export async function runDeleteCenter(
  tenant: { id: string; slug: string; name: string },
  actor: { id: string; name: string }
): Promise<CleanResult> {
  const client = await getClient();
  const db = client.db(dbName);
  const { ObjectId } = await import("mongodb");
  const session = client.startSession();
  const deleted: Record<string, number> = {};

  let tenantOid;
  try {
    tenantOid = new ObjectId(tenant.id);
  } catch {
    await session.endSession();
    return { ok: false, deleted: {}, total: 0, error: "Invalid center." };
  }

  try {
    await session.withTransaction(async () => {
      for (const k of Object.keys(deleted)) delete deleted[k];
      // 1. All operational data for this tenant.
      await deleteTenantData(db, tenant.id, session, deleted);
      // 2. The tenant's users (admins). Platform users have tenantId null and are
      //    never matched here, so the super-admin account is untouched.
      const users = await db
        .collection(Collections.users)
        .deleteMany({ tenantId: tenant.id }, { session });
      deleted[Collections.users] = users.deletedCount ?? 0;
      // 3. The tenant profile itself.
      const t = await db
        .collection(Collections.tenants)
        .deleteOne({ _id: tenantOid }, { session });
      deleted[Collections.tenants] = t.deletedCount ?? 0;
    });
  } catch (err) {
    await session.endSession();
    await writeAudit(db, "delete_center", tenant, actor, "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      deleted: {},
      total: 0,
      error: "The deletion failed and was rolled back — nothing was removed. Please try again.",
    };
  }
  await session.endSession();

  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  await writeAudit(db, "delete_center", tenant, actor, "success", { deleted, total });
  return { ok: true, deleted, total };
}

/** Delete every tenant-scoped operational record for one tenant, recording counts. */
async function deleteTenantData(
  db: Db,
  tenantId: string,
  session: ClientSession,
  deleted: Record<string, number>
): Promise<void> {
  for (const name of TENANT_DATA_COLLECTIONS) {
    const res = await db.collection(name).deleteMany({ tenantId }, { session });
    deleted[name] = res.deletedCount ?? 0;
  }
}

async function writeAudit(
  db: Db,
  action: string,
  tenant: { id: string; slug: string; name: string },
  actor: { id: string; name: string },
  status: "success" | "failed",
  details: Record<string, unknown>
): Promise<void> {
  try {
    await db.collection(Collections.auditLog).insertOne({
      action,
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
