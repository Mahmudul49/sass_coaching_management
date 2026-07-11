import "server-only";
import { redirect } from "next/navigation";
import { forbidden } from "@/lib/http";
import { auth } from "@/auth";
import { requireTenant, getTenantSlug, type PublicTenant } from "@/lib/tenant/server";
import { forTenant, type ScopedDb } from "@/lib/db/scoped";
import type { Role } from "@/lib/db/collections";
import { can, isConsoleRole, type Permission } from "@/lib/auth/permissions";

/**
 * Auth + tenant guards used by layouts, server actions and route handlers.
 *
 * These are the choke points that turn a valid login into authorised access:
 *   - requireSuperAdmin(): session must exist and be role 'superadmin'.
 *   - requireAdmin(): session must be role 'admin', the tenant slug must
 *     resolve to a real tenant, AND session.tenantId must equal that tenant —
 *     otherwise 403. This is what stops one center's admin from poking at
 *     another center's tenant. Returns a `db` already scoped to the tenant.

 */

export type AdminContext = {
  userId: string;
  name: string;
  tenant: PublicTenant;
  /** DB handle pre-bound to this tenant — use this, never raw getDb(). */
  db: ScopedDb;
};


export type ConsoleContext = { userId: string; name: string; role: Role };

export async function requireSuperAdmin(): Promise<{ userId: string; name: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "superadmin") forbidden();
  return { userId: session.user.id, name: session.user.name ?? "" };
}

/**
 * Gate the central console: any platform role (superadmin or platform_admin).
 * Redirects unauthenticated users to /login and 403s tenant admins.
 */
export async function requireConsoleUser(): Promise<ConsoleContext> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isConsoleRole(session.user.role)) forbidden();
  return {
    userId: session.user.id,
    name: session.user.name ?? "",
    role: session.user.role,
  };
}

/**
 * Fine-grained guard for console pages and server actions. 403s when the
 * signed-in role lacks `perm`. Returns the console context for convenience.
 */
export async function requirePermission(perm: Permission): Promise<ConsoleContext> {
  const ctx = await requireConsoleUser();
  if (!can(ctx.role, perm)) forbidden();
  return ctx;
}

export async function requireAdminFromRequest(): Promise<AdminContext> {
  return requireAdmin(await getTenantSlug());
}

export async function requireAdmin(tenantSlug: string): Promise<AdminContext> {
  const tenant = await requireTenant(tenantSlug); // 404 if tenant slug is unknown
  const session = await auth();

  if (!session?.user) redirect(`/${tenantSlug}/login`);

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
