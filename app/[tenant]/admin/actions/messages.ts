"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import { insertMessage, markConversationRead, type MessageResult } from "@/lib/messages/mutations";
import { getThread, type ThreadPage } from "@/lib/messages/queries";
import { revalidateTenantAdminLayout, revalidateTenantAdminPage } from "@/lib/tenant/revalidate";

/**
 * Admin-side messaging actions. An admin can ONLY converse with the Super Admin,
 * and ONLY within their own tenant — the tenantId is taken from the session
 * (requireAdminFromRequest), never from client input, so an admin can never
 * reach another center's conversation or message another admin.
 */

export async function sendToSuper(body: string): Promise<MessageResult> {
  const { tenant, userId, name } = await requireAdminFromRequest();
  const res = await insertMessage({
    tenantId: tenant.id,
    senderRole: "admin",
    senderId: userId,
    senderName: name || tenant.name,
    body,
  });
  if (res.ok) {
    await revalidateTenantAdminPage("messages");
    await revalidateTenantAdminLayout(); // refresh the nav unread badge
  }
  return res;
}

/** Mark the admin's conversation read (clears their unread badge on open). */
export async function markAdminRead(): Promise<{ ok: boolean }> {
  const { tenant } = await requireAdminFromRequest();
  await markConversationRead(tenant.id, "admin");
  await revalidateTenantAdminLayout();
  return { ok: true };
}

/** Cursor "load older" for the admin's thread. */
export async function loadAdminThread(beforeId: string | null): Promise<ThreadPage> {
  const { tenant } = await requireAdminFromRequest();
  return getThread(tenant.id, "admin", { beforeId });
}
