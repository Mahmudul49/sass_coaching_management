"use server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getTenantById } from "@/lib/tenant/server";
import {
  insertMessage,
  markConversationRead,
  softDeleteMessage,
  broadcastToAllAdmins,
  type MessageResult,
} from "@/lib/messages/mutations";
import { getThread, listConversationsForSuper, type ThreadPage, type InboxPage } from "@/lib/messages/queries";

/**
 * Super-Admin messaging actions. Every one is gated by requireSuperAdmin(), so a
 * tenant admin or a (view-only) platform_admin can never send, broadcast, mark
 * read, or soft delete. The Super Admin may act on ANY tenant conversation.
 */

function revalidateConsoleMessaging(tenantId?: string) {
  revalidatePath("/superadmin/messages");
  if (tenantId) revalidatePath(`/superadmin/messages/${tenantId}`);
  revalidatePath("/superadmin", "layout"); // nav unread badge
}

export async function sendToAdmin(tenantId: string, body: string): Promise<MessageResult> {
  const { userId, name } = await requireSuperAdmin();
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Center not found." };

  const res = await insertMessage({
    tenantId: tenant.id,
    senderRole: "superadmin",
    senderId: userId,
    senderName: name || "Super Admin",
    body,
  });
  if (res.ok) revalidateConsoleMessaging(tenant.id);
  return res;
}

export async function broadcast(body: string): Promise<{ ok: boolean; delivered: number; error?: string }> {
  const { userId, name } = await requireSuperAdmin();
  const res = await broadcastToAllAdmins({ senderId: userId, senderName: name || "Super Admin", body });
  if (res.ok) revalidateConsoleMessaging();
  return res;
}

export async function markSuperRead(tenantId: string): Promise<{ ok: boolean }> {
  await requireSuperAdmin();
  await markConversationRead(tenantId, "superadmin");
  revalidateConsoleMessaging(tenantId);
  return { ok: true };
}

export async function deleteMessage(messageId: string, tenantId: string): Promise<MessageResult> {
  const { userId } = await requireSuperAdmin();
  const res = await softDeleteMessage(messageId, userId);
  if (res.ok) revalidateConsoleMessaging(tenantId);
  return res;
}

export async function loadSuperThread(tenantId: string, beforeId: string | null): Promise<ThreadPage> {
  await requireSuperAdmin();
  return getThread(tenantId, "superadmin", { beforeId });
}

export async function loadInbox(search: string, skip: number): Promise<InboxPage> {
  await requireSuperAdmin();
  return listConversationsForSuper({ search }, { skip });
}
