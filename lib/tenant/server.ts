import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/connect";
import { Collections, type TenantDoc } from "@/lib/db/collections";

/**
 * Server-side (Node runtime) tenant resolution. This is where the DB-backed
 * checks the edge middleware can't do actually happen.
 */

export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  attendanceSmsEnabled: boolean;
};

// Tiny per-process cache: slug -> tenant. Cuts repeated M0 lookups on a warm
// lambda. Cleared naturally when the container recycles.
const globalForTenant = globalThis as unknown as {
  _tenantCache?: Map<string, { value: PublicTenant | null; at: number }>;
};
const cache = (globalForTenant._tenantCache ??= new Map());
const TTL_MS = 30_000;

function toPublic(doc: TenantDoc): PublicTenant {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    active: doc.active,
    attendanceSmsEnabled: !!doc.attendanceSmsEnabled,
  };
}

/** Look a tenant up by slug (cached). Returns null if not found. */
export async function getTenantBySlug(slug: string): Promise<PublicTenant | null> {
  if (!slug) return null;


  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const db = await getDb();
  const doc = await db
    .collection<TenantDoc>(Collections.tenants)
    .findOne({ slug });
  const value = doc ? toPublic(doc) : null;
  cache.set(slug, { value, at: Date.now() });
  return value;
}

/** Invalidate the cache for a slug (call after create/activate/deactivate). */
export function invalidateTenant(slug: string) {
  cache.delete(slug);
}

/** Read the tenant slug set by edge middleware from the request path. */
export async function getTenantSlug(): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-slug") ?? "";
}

/**
 * Resolve a tenant by slug or 404.
 * Use this in any tenant-scoped route, e.g. `app/[tenant]/admin/*`.
 */
export async function requireTenant(tenantSlug: string): Promise<PublicTenant> {
  const slug = String(tenantSlug ?? "").trim();
  if (!slug) notFound();
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  return tenant;
}

