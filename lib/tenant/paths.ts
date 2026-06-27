/**
 * Path-based tenant URL helpers.
 * Tenant sites live at /{slug}/admin/* and /{slug}/login.
 */

const RESERVED_SEGMENTS = new Set([
  "superadmin",
  "login",
  "api",
  "admin",
  "_next",
]);

/** Extract tenant slug from a pathname (first segment if not reserved). */
export function slugFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg || RESERVED_SEGMENTS.has(seg)) return "";
  return seg;
}

export function tenantAdminPath(slug: string, sub = ""): string {
  const base = `/${slug}/admin`;
  return sub ? `${base}/${sub}` : base;
}

export function tenantLoginPath(slug: string): string {
  return `/${slug}/login`;
}

export function tenantSiteUrl(slug: string, rootDomain: string): string {
  const protocol = rootDomain.includes("localhost") ? "http" : "https";
  return `${protocol}://${rootDomain}/${slug}`;
}

export function tenantSiteLabel(slug: string, rootDomain: string): string {
  return `${rootDomain}/${slug}`;
}
