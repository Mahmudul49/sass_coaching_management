import "server-only";
import { getDb } from "@/lib/db/connect";
import {
  Collections,
  type ConversationDoc,
  type MessageDoc,
  type MessageSenderRole,
  type TenantDoc,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { MESSAGE_MAX } from "./constants";

/**
 * ADMIN MESSAGING — write layer. All mutations funnel through here so the admin
 * and super action files stay thin and can never drift. Authorisation is done by
 * the callers (requireAdmin / requireSuperAdmin); these functions assume the
 * caller has already proven the right to act on `tenantId`.
 */

export type MessageResult = { ok: boolean; error?: string };

/** Trim + bound a message body. Returns null when empty/too long. */
export function normalizeBody(input: string): string | null {
  const body = String(input ?? "").trim();
  if (!body) return null;
  if (body.length > MESSAGE_MAX) return null;
  return body;
}

function preview(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine;
}

/**
 * Append a message to a tenant's conversation (creating the conversation on the
 * first message). Bumps the recipient's unread counter atomically.
 */
export async function insertMessage(args: {
  tenantId: string;
  senderRole: MessageSenderRole;
  senderId: string;
  senderName: string;
  body: string;
}): Promise<MessageResult> {
  const body = normalizeBody(args.body);
  if (!body) return { ok: false, error: "Message is empty or too long." };

  const db = await getDb();
  const now = new Date();
  const incField = args.senderRole === "superadmin" ? "adminUnread" : "superUnread";
  const zeroField = args.senderRole === "superadmin" ? "superUnread" : "adminUnread";

  const conv = await db.collection<ConversationDoc>(Collections.conversations).findOneAndUpdate(
    { tenantId: args.tenantId },
    {
      $set: { lastMessageAt: now, lastMessagePreview: preview(body), lastSenderRole: args.senderRole },
      $inc: { [incField]: 1 },
      $setOnInsert: { tenantId: args.tenantId, createdAt: now, [zeroField]: 0 },
    },
    { upsert: true, returnDocument: "after" }
  );
  const conversationId = conv?._id.toString();
  if (!conversationId) return { ok: false, error: "Could not open the conversation." };

  await db.collection<MessageDoc>(Collections.messages).insertOne({
    tenantId: args.tenantId,
    conversationId,
    senderRole: args.senderRole,
    senderId: args.senderId,
    senderName: args.senderName,
    body,
    createdAt: now,
    readByAdmin: args.senderRole === "admin",
    readBySuper: args.senderRole === "superadmin",
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  } as MessageDoc);

  return { ok: true };
}

/** Mark a tenant's conversation as read for one side (clears its unread badge). */
export async function markConversationRead(
  tenantId: string,
  viewerRole: MessageSenderRole
): Promise<void> {
  const db = await getDb();
  const isAdmin = viewerRole === "admin";
  await Promise.all([
    db
      .collection<ConversationDoc>(Collections.conversations)
      .updateOne({ tenantId }, { $set: isAdmin ? { adminUnread: 0 } : { superUnread: 0 } }),
    db.collection<MessageDoc>(Collections.messages).updateMany(
      {
        tenantId,
        senderRole: isAdmin ? "superadmin" : "admin",
        ...(isAdmin ? { readByAdmin: false } : { readBySuper: false }),
      },
      { $set: isAdmin ? { readByAdmin: true } : { readBySuper: true } }
    ),
  ]);
}

/** Soft delete a single message (Super Admin only — caller enforces the role). */
export async function softDeleteMessage(messageId: string, byUserId: string): Promise<MessageResult> {
  const _id = toObjectId(messageId);
  if (!_id) return { ok: false, error: "Invalid message id." };
  const db = await getDb();
  const res = await db
    .collection<MessageDoc>(Collections.messages)
    .updateOne({ _id }, { $set: { deleted: true, deletedAt: new Date(), deletedBy: byUserId } });
  if (res.matchedCount === 0) return { ok: false, error: "Message not found." };
  return { ok: true };
}

/**
 * Broadcast one message to every tenant admin. Upserts each conversation and
 * inserts one message per tenant in bulk — a single round-trip each, so it scales
 * past hundreds of centers without fanning out requests.
 */
export async function broadcastToAllAdmins(args: {
  senderId: string;
  senderName: string;
  body: string;
}): Promise<{ ok: boolean; delivered: number; error?: string }> {
  const body = normalizeBody(args.body);
  if (!body) return { ok: false, delivered: 0, error: "Message is empty or too long." };

  const db = await getDb();
  const tenants = (await db
    .collection<TenantDoc>(Collections.tenants)
    .find({}, { projection: { _id: 1 } })
    .toArray()) as Pick<TenantDoc, "_id">[];
  if (tenants.length === 0) return { ok: true, delivered: 0 };

  const now = new Date();
  const tenantIds = tenants.map((t) => t._id.toString());

  await db.collection<ConversationDoc>(Collections.conversations).bulkWrite(
    tenantIds.map((tenantId) => ({
      updateOne: {
        filter: { tenantId },
        update: {
          $set: { lastMessageAt: now, lastMessagePreview: preview(body), lastSenderRole: "superadmin" as const },
          $inc: { adminUnread: 1 },
          $setOnInsert: { tenantId, createdAt: now, superUnread: 0 },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  const convs = (await db
    .collection<ConversationDoc>(Collections.conversations)
    .find({ tenantId: { $in: tenantIds } }, { projection: { tenantId: 1 } })
    .toArray()) as Pick<ConversationDoc, "_id" | "tenantId">[];
  const convIdByTenant = new Map(convs.map((c) => [c.tenantId, c._id.toString()]));

  const docs: MessageDoc[] = tenantIds.map((tenantId) => ({
    tenantId,
    conversationId: convIdByTenant.get(tenantId) ?? "",
    senderRole: "superadmin",
    senderId: args.senderId,
    senderName: args.senderName,
    body,
    createdAt: now,
    readByAdmin: false,
    readBySuper: true,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  })) as MessageDoc[];
  await db.collection<MessageDoc>(Collections.messages).insertMany(docs);

  return { ok: true, delivered: tenantIds.length };
}
