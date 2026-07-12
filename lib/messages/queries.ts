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
 * ADMIN MESSAGING — read layer (platform-level, spans super ↔ tenant).
 *
 * These helpers use the raw db because the Super Admin reads across every tenant
 * (like lib/superadmin/queries.ts). Isolation for the ADMIN side is the caller's
 * responsibility: admin call sites always pass the tenantId resolved from their
 * session (never client input), so an admin can only ever see their own thread.
 *
 * Realtime-ready: the thread is cursor-paginated by `_id` and messages carry a
 * monotonic `createdAt`, so an SSE/WebSocket push (or a "load newer" poll) can be
 * layered on later without changing this contract. Not implemented now.
 */

/** Serialisable message shape handed to client components. */
export type MessageRow = {
  id: string;
  senderRole: MessageSenderRole;
  senderName: string;
  body: string;
  createdAt: string; // ISO
  deleted: boolean;
  mine: boolean; // authored by the viewer
  read: boolean; // for my messages: has the other side read it
};

export type ThreadPage = {
  rows: MessageRow[]; // ascending (oldest → newest) for display
  hasMore: boolean; // older messages exist above
  oldestId: string | null; // cursor for "load older"
};

/** Inbox row for the Super Admin conversation list. */
export type ConversationRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  centerActive: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastSenderRole: MessageSenderRole | null;
  unread: number; // unread by the super
};

export type InboxPage = {
  rows: ConversationRow[];
  hasMore: boolean;
  total: number;
  totalUnread: number;
};

export { MESSAGE_MAX };

function toRow(m: MessageDoc, viewerRole: MessageSenderRole): MessageRow {
  const mine = m.senderRole === viewerRole;
  const readByOther = viewerRole === "superadmin" ? m.readByAdmin : m.readBySuper;
  return {
    id: m._id.toString(),
    senderRole: m.senderRole,
    senderName: m.senderName,
    body: m.deleted ? "" : m.body,
    createdAt: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
    deleted: !!m.deleted,
    mine,
    read: mine ? !!readByOther : true,
  };
}

/**
 * Load a conversation thread for one tenant, newest page first. Returns rows in
 * ascending order for display plus a cursor to fetch older messages.
 */
export async function getThread(
  tenantId: string,
  viewerRole: MessageSenderRole,
  page: { beforeId?: string | null; limit?: number } = {}
): Promise<ThreadPage> {
  const limit = Math.min(Math.max(page.limit ?? 30, 1), 100);
  const db = await getDb();
  const q: Record<string, unknown> = { tenantId };
  if (page.beforeId) {
    const oid = toObjectId(page.beforeId);
    if (oid) q._id = { $lt: oid };
  }
  const docs = (await db
    .collection<MessageDoc>(Collections.messages)
    .find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray()) as MessageDoc[];

  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;
  const rows = slice.reverse().map((m) => toRow(m, viewerRole)); // ascending
  return { rows, hasMore, oldestId: rows.length ? rows[0].id : null };
}

/** The tenant admin's own conversation partner (super side always exists). */
export async function getConversation(tenantId: string): Promise<ConversationDoc | null> {
  const db = await getDb();
  return db.collection<ConversationDoc>(Collections.conversations).findOne({ tenantId });
}

/** Unread badge for a tenant admin (messages from super they haven't opened). */
export async function getAdminUnread(tenantId: string): Promise<number> {
  const conv = await getConversation(tenantId);
  return Math.max(0, conv?.adminUnread ?? 0);
}

/** Total unread across every conversation, for the Super Admin nav badge. */
export async function getSuperUnreadTotal(): Promise<number> {
  const db = await getDb();
  const agg = await db
    .collection<ConversationDoc>(Collections.conversations)
    .aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$superUnread" } } }])
    .toArray();
  return Math.max(0, agg[0]?.total ?? 0);
}

/**
 * Super Admin inbox. Conversations joined with their tenant (name/slug/active),
 * newest activity first, optional name/slug search, offset-paginated. Tenant
 * count is bounded, so the join+filter in memory is cheap and avoids denormalised
 * (stale) tenant names on the conversation doc.
 */
export async function listConversationsForSuper(
  filter: { search?: string } = {},
  page: { skip?: number; limit?: number } = {}
): Promise<InboxPage> {
  const limit = Math.min(Math.max(page.limit ?? 30, 1), 100);
  const skip = Math.max(page.skip ?? 0, 0);
  const db = await getDb();

  const [convs, tenants] = await Promise.all([
    db
      .collection<ConversationDoc>(Collections.conversations)
      .find({})
      .sort({ lastMessageAt: -1, _id: -1 })
      .toArray(),
    db.collection<TenantDoc>(Collections.tenants).find({}).toArray(),
  ]);
  const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t]));

  let rows: ConversationRow[] = convs.map((c) => {
    const t = tenantMap.get(c.tenantId);
    return {
      tenantId: c.tenantId,
      tenantName: t?.name ?? "Unknown center",
      tenantSlug: t?.slug ?? "",
      centerActive: t?.active !== false,
      lastMessageAt: c.lastMessageAt
        ? (c.lastMessageAt instanceof Date ? c.lastMessageAt : new Date(c.lastMessageAt)).toISOString()
        : null,
      lastMessagePreview: c.lastMessagePreview ?? "",
      lastSenderRole: c.lastSenderRole ?? null,
      unread: Math.max(0, c.superUnread ?? 0),
    };
  });

  const q = filter.search?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.tenantName.toLowerCase().includes(q) || r.tenantSlug.includes(q));

  const totalUnread = rows.reduce((s, r) => s + r.unread, 0);
  const total = rows.length;
  const pageRows = rows.slice(skip, skip + limit);
  return { rows: pageRows, hasMore: skip + limit < total, total, totalUnread };
}

/** Tenants that don't yet have a conversation — for the "start a message" picker. */
export type MessageableTenant = { tenantId: string; name: string; slug: string; active: boolean };

export async function listMessageableTenants(): Promise<MessageableTenant[]> {
  const db = await getDb();
  const tenants = await db
    .collection<TenantDoc>(Collections.tenants)
    .find({}, { projection: { name: 1, slug: 1, active: 1 } })
    .sort({ name: 1 })
    .toArray();
  return tenants.map((t) => ({
    tenantId: t._id.toString(),
    name: t.name,
    slug: t.slug,
    active: t.active !== false,
  }));
}
