"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connect";
import { Collections, type TenantDoc, type UserDoc } from "@/lib/db/collections";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { invalidateTenant } from "@/lib/tenant/server";
import { runCleanCenterData, runDeleteCenter } from "@/lib/superadmin/cleanData";

export type ActionResult = { ok: boolean; error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const RESERVED = new Set(["www", "admin", "api", "app", "login", "superadmin"]);

/** Create a tenant + its admin user in one step (§8 super-admin dashboard). */
export async function createTenant(input: {
  name: string;
  adminName: string;
  phone: string;
  password: string;
  slug: string;
}): Promise<ActionResult> {
  await requireSuperAdmin();

  const name = input.name?.trim();
  const adminName = input.adminName?.trim();
  const phone = input.phone?.trim();
  const password = input.password ?? "";
  const slug = input.slug?.trim().toLowerCase();

  if (!name) return { ok: false, error: "Enter the center name." };
  if (!adminName) return { ok: false, error: "Enter the admin name." };
  if (!phone) return { ok: false, error: "Enter the phone number." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { ok: false, error: "Invalid slug (lowercase letters, digits and hyphen only)." };
  }

  const db = await getDb();

  const existing = await db.collection(Collections.tenants).findOne({ slug });
  if (existing) return { ok: false, error: "This slug is already in use." };

  const now = new Date();
  const tenantRes = await db.collection(Collections.tenants).insertOne({
    slug,
    name,
    adminName,
    adminPhone: phone,
    active: true,
    attendanceSmsEnabled: false, // cost control: off by default
    createdAt: now,
  });
  const tenantId = tenantRes.insertedId.toString();

  const passwordHash = await hashPassword(password);
  try {
    await db.collection(Collections.users).insertOne({
      tenantId,
      name: adminName,
      phone,
      passwordHash,
      role: "admin",
    });
  } catch {
    // Roll back the tenant if the admin (unique tenantId+phone) couldn't be made.
    await db.collection(Collections.tenants).deleteOne({ _id: tenantRes.insertedId });
    return { ok: false, error: "Could not create the admin — please re-check the phone number." };
  }

  invalidateTenant(slug);
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Edit a tenant's center name, slug, admin name, phone, and (optional) password. */
export async function updateTenant(
  tenantId: string,
  input: {
    name: string;
    slug: string;
    adminName: string;
    phone: string;
    password?: string;
  }
): Promise<ActionResult> {
  await requireSuperAdmin();

  const name = input.name?.trim();
  const adminName = input.adminName?.trim();
  const phone = input.phone?.trim();
  const slug = input.slug?.trim().toLowerCase();
  const password = input.password?.trim() ?? "";

  if (!name) return { ok: false, error: "Enter the center name." };
  if (!adminName) return { ok: false, error: "Enter the admin name." };
  if (!phone) return { ok: false, error: "Enter the phone number." };
  if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { ok: false, error: "Invalid slug (lowercase letters, digits and hyphen only)." };
  }
  if (password && password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const db = await getDb();
  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(tenantId);
  } catch {
    return { ok: false, error: "Invalid ID." };
  }

  const tenant = await db.collection(Collections.tenants).findOne({ _id });
  if (!tenant) return { ok: false, error: "Center not found." };

  // Slug must stay globally unique.
  if (slug !== tenant.slug) {
    const clash = await db.collection(Collections.tenants).findOne({ slug });
    if (clash) return { ok: false, error: "This slug is already in use." };
  }

  await db
    .collection(Collections.tenants)
    .updateOne({ _id }, { $set: { name, slug, adminName, adminPhone: phone } });

  // Mirror to the tenant's admin user; set new password only if provided.
  const userSet: Record<string, unknown> = { name: adminName, phone };
  if (password) userSet.passwordHash = await hashPassword(password);
  await db
    .collection(Collections.users)
    .updateOne({ tenantId, role: "admin" }, { $set: userSet });

  invalidateTenant(tenant.slug as string);
  invalidateTenant(slug);
  revalidatePath("/superadmin");
  return { ok: true };
}

/** Activate / deactivate a tenant. */
export async function setTenantActive(
  tenantId: string,
  active: boolean
): Promise<ActionResult> {
  await requireSuperAdmin();
  const db = await getDb();
  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(tenantId);
  } catch {
    return { ok: false, error: "Invalid ID." };
  }
  const tenant = await db.collection(Collections.tenants).findOne({ _id });
  if (!tenant) return { ok: false, error: "Center not found." };

  await db.collection(Collections.tenants).updateOne({ _id }, { $set: { active } });
  invalidateTenant(tenant.slug as string);
  revalidatePath("/superadmin");
  return { ok: true };
}

export type CleanDataResult = {
  ok: boolean;
  error?: string;
  deleted?: Record<string, number>;
  total?: number;
};

/**
 * CLEAN CENTER DATA (SuperAdmin only). Irreversibly wipes a center's operational
 * data while preserving its profile + admin account. Requires the exact phrase
 * "CLEAN CENTER" AND the acting super-admin's own password, both re-verified here
 * on the server — the client checks are only for UX and are never trusted.
 */
export async function cleanCenterData(input: {
  tenantId: string;
  confirmText: string;
  password: string;
}): Promise<CleanDataResult> {
  const { userId, name } = await requireSuperAdmin(); // 403s non-superadmins

  if ((input.confirmText ?? "").trim() !== "CLEAN CENTER") {
    return { ok: false, error: 'Type "CLEAN CENTER" exactly to confirm.' };
  }
  if (!input.password) return { ok: false, error: "Enter your Super Admin password." };

  const db = await getDb();
  const { ObjectId } = await import("mongodb");

  let tenantOid;
  try {
    tenantOid = new ObjectId(input.tenantId);
  } catch {
    return { ok: false, error: "Invalid center." };
  }
  const tenant = await db.collection<TenantDoc>(Collections.tenants).findOne({ _id: tenantOid });
  if (!tenant) return { ok: false, error: "Center not found." };

  // Re-verify the acting super-admin's password against their own record.
  let actorOid;
  try {
    actorOid = new ObjectId(userId);
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  const actor = await db
    .collection<UserDoc>(Collections.users)
    .findOne({ _id: actorOid, tenantId: null, role: "superadmin" });
  if (!actor) return { ok: false, error: "Not authorized." };
  const passwordOk = await verifyPassword(input.password, actor.passwordHash);
  if (!passwordOk) return { ok: false, error: "Password is incorrect." };

  const res = await runCleanCenterData(
    { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name },
    { id: userId, name }
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Cleanup failed." };

  // The center now has a fresh database — refresh cached tenant + student counts.
  invalidateTenant(tenant.slug);
  revalidatePath("/superadmin");
  return { ok: true, deleted: res.deleted, total: res.total };
}

/**
 * DELETE CENTER (SuperAdmin only). Irreversibly removes a tenant ENTIRELY —
 * operational data, its users (admin) and the tenant profile — freeing the slug.
 * Requires the exact phrase "DELETE CENTER" AND the acting super-admin's own
 * password, both re-verified here on the server (client checks are UX only and
 * never trusted). Only this tenant's data is touched; other tenants are safe.
 */
export async function deleteCenter(input: {
  tenantId: string;
  confirmText: string;
  password: string;
}): Promise<CleanDataResult> {
  const { userId, name } = await requireSuperAdmin(); // 403s non-superadmins

  if ((input.confirmText ?? "").trim() !== "DELETE CENTER") {
    return { ok: false, error: 'Type "DELETE CENTER" exactly to confirm.' };
  }
  if (!input.password) return { ok: false, error: "Enter your Super Admin password." };

  const db = await getDb();
  const { ObjectId } = await import("mongodb");

  let tenantOid;
  try {
    tenantOid = new ObjectId(input.tenantId);
  } catch {
    return { ok: false, error: "Invalid center." };
  }
  const tenant = await db.collection<TenantDoc>(Collections.tenants).findOne({ _id: tenantOid });
  if (!tenant) return { ok: false, error: "Center not found." };

  // Re-verify the acting super-admin's password against their own record.
  let actorOid;
  try {
    actorOid = new ObjectId(userId);
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  const actor = await db
    .collection<UserDoc>(Collections.users)
    .findOne({ _id: actorOid, tenantId: null, role: "superadmin" });
  if (!actor) return { ok: false, error: "Not authorized." };
  const passwordOk = await verifyPassword(input.password, actor.passwordHash);
  if (!passwordOk) return { ok: false, error: "Password is incorrect." };

  const res = await runDeleteCenter(
    { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name },
    { id: userId, name }
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Deletion failed." };

  // The center is gone — drop its cached tenant entry and refresh the list.
  invalidateTenant(tenant.slug);
  revalidatePath("/superadmin");
  return { ok: true, deleted: res.deleted, total: res.total };
}
