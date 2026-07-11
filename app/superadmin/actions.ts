"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connect";
import { Collections } from "@/lib/db/collections";
import { hashPassword } from "@/lib/auth/password";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { invalidateTenant } from "@/lib/tenant/server";

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
