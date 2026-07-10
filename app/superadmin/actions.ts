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

  if (!name) return { ok: false, error: "সেন্টারের নাম দিন।" };
  if (!adminName) return { ok: false, error: "অ্যাডমিনের নাম দিন।" };
  if (!phone) return { ok: false, error: "ফোন নম্বর দিন।" };
  if (password.length < 6) return { ok: false, error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" };
  if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { ok: false, error: "সাবডোমেইন সঠিক নয় (শুধু ছোট হাতের অক্ষর, সংখ্যা ও hyphen)।" };
  }

  const db = await getDb();

  const existing = await db.collection(Collections.tenants).findOne({ slug });
  if (existing) return { ok: false, error: "এই সাবডোমেইন আগে থেকেই ব্যবহৃত হচ্ছে।" };

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
    return { ok: false, error: "অ্যাডমিন তৈরি করা যায়নি — ফোন নম্বরটি পুনরায় চেক করুন।" };
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

  if (!name) return { ok: false, error: "সেন্টারের নাম দিন।" };
  if (!adminName) return { ok: false, error: "অ্যাডমিনের নাম দিন।" };
  if (!phone) return { ok: false, error: "ফোন নম্বর দিন।" };
  if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return { ok: false, error: "সাইট (slug) সঠিক নয় (শুধু ছোট হাতের অক্ষর, সংখ্যা ও hyphen)।" };
  }
  if (password && password.length < 6) {
    return { ok: false, error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" };
  }

  const db = await getDb();
  const { ObjectId } = await import("mongodb");
  let _id;
  try {
    _id = new ObjectId(tenantId);
  } catch {
    return { ok: false, error: "ভুল আইডি।" };
  }

  const tenant = await db.collection(Collections.tenants).findOne({ _id });
  if (!tenant) return { ok: false, error: "সেন্টার পাওয়া যায়নি।" };

  // Slug must stay globally unique.
  if (slug !== tenant.slug) {
    const clash = await db.collection(Collections.tenants).findOne({ slug });
    if (clash) return { ok: false, error: "এই সাইট (slug) আগে থেকেই ব্যবহৃত হচ্ছে।" };
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
    return { ok: false, error: "ভুল আইডি।" };
  }
  const tenant = await db.collection(Collections.tenants).findOne({ _id });
  if (!tenant) return { ok: false, error: "সেন্টার পাওয়া যায়নি।" };

  await db.collection(Collections.tenants).updateOne({ _id }, { $set: { active } });
  invalidateTenant(tenant.slug as string);
  revalidatePath("/superadmin");
  return { ok: true };
}
