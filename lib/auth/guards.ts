import "server-only";
import { redirect } from "next/navigation";
import { forbidden } from "@/lib/http";
import { auth } from "@/auth";
import { requireTenant, type PublicTenant } from "@/lib/tenant/server";
import { forTenant, type ScopedDb } from "@/lib/db/scoped";

/**
 * Auth + tenant guards used by layouts, server actions and route handlers.
 *
 * These are the choke points that turn a valid login into authorised access:
 *   - requireSuperAdmin(): session must exist and be role 'superadmin'.
 *   - requireAdmin(): session must be role 'admin', the subdomain must resolve
 *     to a real tenant, AND session.tenantId must equal that tenant — otherwise
 *     403. This is what stops one center's admin from poking at another center's
 *     subdomain. Returns a `db` already scoped to the tenant.
 */

export type AdminContext = {
  userId: string;
  name: string;
  tenant: PublicTenant;
  /** DB handle pre-bound to this tenant — use this, never raw getDb(). */
  db: ScopedDb;
};

export async function requireSuperAdmin(): Promise<{ userId: string; name: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "superadmin") forbidden();
  return { userId: session.user.id, name: session.user.name ?? "" };
}

export async function requireAdmin(): Promise<AdminContext> {
  const tenant = await requireTenant(); // 404 if subdomain is unknown
  const session = await auth();
  if (!session?.user) redirect("/login");

  // A super-admin has no business inside a tenant admin area, and an admin
  // bound to a different tenant must be blocked.
  if (session.user.role !== "admin" || session.user.tenantId !== tenant.id) {
    forbidden();
  }

  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    tenant,
    db: forTenant(tenant.id),
  };
}
