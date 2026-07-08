"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/connect";
import { Collections, type UserDoc } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { invalidateTenant } from "@/lib/tenant/server";
import {
  revalidateTenantAdminPage,
  revalidateTenantAdminLayout,
} from "@/lib/tenant/revalidate";

export type ActionResult = { ok: boolean; error?: string };

/** Admin edits their center name (tenants.name). */
export async function updateCenterName(name: string): Promise<ActionResult> {
  const { tenant } = await requireAdminFromRequest();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "সেন্টারের নাম দিন।" };
  const db = await getDb();
  const _id = toObjectId(tenant.id);
  if (!_id) return { ok: false, error: "ভুল আইডি।" };

  await db.collection(Collections.tenants).updateOne({ _id }, { $set: { name: trimmed } });
  invalidateTenant(tenant.slug);
  await revalidateTenantAdminLayout(); // top bar / sidebar shows center name
  return { ok: true };
}

/** Admin edits their own display name (users.name + tenants.adminName). */
export async function updateAdminName(name: string): Promise<ActionResult> {
  const { tenant, userId } = await requireAdminFromRequest();
  const trimmed = name?.trim();
  if (!trimmed) return { ok: false, error: "অ্যাডমিনের নাম দিন।" };
  const db = await getDb();
  const uid = toObjectId(userId);
  const tid = toObjectId(tenant.id);
  if (!uid || !tid) return { ok: false, error: "ভুল আইডি।" };

  await db
    .collection(Collections.users)
    .updateOne({ _id: uid, tenantId: tenant.id, role: "admin" }, { $set: { name: trimmed } });
  await db.collection(Collections.tenants).updateOne({ _id: tid }, { $set: { adminName: trimmed } });
  invalidateTenant(tenant.slug);
  await revalidateTenantAdminPage("settings");
  return { ok: true };
}

/** Admin changes their password (verify current, then set new). */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const { tenant, userId } = await requireAdminFromRequest();
  if (!currentPassword) return { ok: false, error: "বর্তমান পাসওয়ার্ড দিন।" };
  if (!newPassword || newPassword.length < 6)
    return { ok: false, error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" };

  const db = await getDb();
  const uid = toObjectId(userId);
  if (!uid) return { ok: false, error: "ভুল আইডি।" };

  const user = (await db
    .collection<UserDoc>(Collections.users)
    .findOne({ _id: uid, tenantId: tenant.id, role: "admin" })) as UserDoc | null;
  if (!user) return { ok: false, error: "অ্যাডমিন পাওয়া যায়নি।" };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "বর্তমান পাসওয়ার্ড সঠিক নয়।" };

  await db
    .collection(Collections.users)
    .updateOne({ _id: uid }, { $set: { passwordHash: await hashPassword(newPassword) } });
  return { ok: true };
}

/** Toggle attendance SMS for this tenant (payment SMS is always on). */
export async function setAttendanceSms(enabled: boolean): Promise<ActionResult> {
  const { tenant } = await requireAdminFromRequest();
  const db = await getDb();
  const _id = toObjectId(tenant.id);
  if (!_id) return { ok: false, error: "ভুল আইডি।" };

  await db
    .collection(Collections.tenants)
    .updateOne({ _id }, { $set: { attendanceSmsEnabled: !!enabled } });
  invalidateTenant(tenant.slug);
  await revalidateTenantAdminPage("settings");
  await revalidateTenantAdminPage("attendance");
  return { ok: true };
}
