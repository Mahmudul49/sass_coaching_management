import "server-only";
import { getDb } from "@/lib/db/connect";

/**
 * Login brute-force guard.
 *
 * A small, dependency-free rate limiter backed by a MongoDB collection with a
 * TTL index — no Redis, works on serverless (Vercel) + Atlas M0. Keyed per
 * account (slug + phone): after MAX_ATTEMPTS failed logins inside WINDOW_MS the
 * identity is locked, and the counter auto-clears when the window passes (the
 * TTL index reaps the doc).
 *
 * FAIL-OPEN by design: every operation swallows DB errors and degrades to
 * "not limited". A limiter outage must never lock every legitimate user out of
 * the app — protection is best-effort, availability is not.
 */

const COLLECTION = "loginAttempts";

/** Max failed attempts allowed inside WINDOW_MS before the account is locked. */
export const MAX_ATTEMPTS = 5;
/** Fixed count / lock window. */
export const WINDOW_MS = 15 * 60 * 1000;

type AttemptDoc = {
  _id: string; // the rate-limit key
  fails: number;
  firstAt: Date;
  expiresAt: Date; // TTL anchor — Mongo removes the doc once this passes
};

// Ensure the TTL index once per process (idempotent), mirroring lib/db/connect.
const g = globalThis as unknown as { _loginRlReady?: Promise<void> };

async function attempts() {
  const db = await getDb();
  const col = db.collection<AttemptDoc>(COLLECTION);
  if (!g._loginRlReady) {
    g._loginRlReady = col
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .then(() => undefined)
      .catch((err) => {
        console.error("loginAttempts TTL index failed:", err);
        g._loginRlReady = undefined; // let a later call retry
      });
  }
  return col;
}

/** Build the per-account key. Console login has an empty slug (own namespace). */
export function loginKey(slug: string, phone: string): string {
  return `id:${slug.trim().toLowerCase()}:${phone.trim().toLowerCase()}`;
}

export type RateLimitStatus = {
  blocked: boolean;
  retryAfterSec: number;
  remaining: number;
};

const OK: RateLimitStatus = { blocked: false, retryAfterSec: 0, remaining: MAX_ATTEMPTS };

/** Read the current status for a key WITHOUT recording anything. */
export async function checkRateLimit(key: string): Promise<RateLimitStatus> {
  try {
    const col = await attempts();
    const doc = await col.findOne({ _id: key });
    const now = Date.now();
    if (!doc || doc.expiresAt.getTime() <= now) return OK; // no live window
    if (doc.fails >= MAX_ATTEMPTS) {
      return {
        blocked: true,
        retryAfterSec: Math.max(1, Math.ceil((doc.expiresAt.getTime() - now) / 1000)),
        remaining: 0,
      };
    }
    return { blocked: false, retryAfterSec: 0, remaining: Math.max(0, MAX_ATTEMPTS - doc.fails) };
  } catch {
    return OK; // fail-open
  }
}

/** Record one failed attempt; starts a fresh window if none is currently live. */
export async function recordFailure(key: string): Promise<void> {
  try {
    const col = await attempts();
    const now = new Date();
    // Increment only while a window is still live…
    const res = await col.updateOne(
      { _id: key, expiresAt: { $gt: now } },
      { $inc: { fails: 1 } }
    );
    // …otherwise (no doc, or a stale one the TTL hasn't reaped yet) start over.
    if (res.matchedCount === 0) {
      // On upsert Mongo takes _id from the filter, so the replacement omits it.
      await col.replaceOne(
        { _id: key },
        { fails: 1, firstAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) },
        { upsert: true }
      );
    }
  } catch {
    // swallow — never fail a login flow because the limiter write failed
  }
}

/** Clear a key's attempts (call on a successful login). */
export async function clearAttempts(key: string): Promise<void> {
  try {
    const col = await attempts();
    await col.deleteOne({ _id: key });
  } catch {
    // swallow
  }
}
