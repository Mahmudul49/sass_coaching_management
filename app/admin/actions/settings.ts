"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/connect";
import { Collections } from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { invalidateTenant } from "@/lib/tenant/server";

export type ActionResult = { ok: boolean; error?: string };

/** Toggle attendance SMS for this tenant (payment SMS is always on). */
export async function setAttendanceSms(enabled: boolean): Promise<ActionResult> {
  const { tenant } = await requireAdmin();
  const db = await getDb();
  const _id = toObjectId(tenant.id);
  if (!_id) return { ok: false, error: "ভুল আইডি।" };

  // Safe: requireAdmin already proved session.tenantId === this tenant.
  await db
    .collection(Collections.tenants)
    .updateOne({ _id }, { $set: { attendanceSmsEnabled: !!enabled } });
  invalidateTenant(tenant.slug);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/attendance");
  return { ok: true };
}
