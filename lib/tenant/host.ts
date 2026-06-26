/**
 * Pure host-parsing helpers shared by the edge middleware and server code.
 * No DB, no Node APIs here so it is safe to import from the Edge runtime.
 */

const ROOT_DOMAIN = (process.env.ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
const ROOT_HOST = ROOT_DOMAIN.split(":")[0]; // strip port

/**
 * Extract the tenant slug from a Host header.
 *   demo.localhost:3000        -> "demo"
 *   demo.yourdomain.com        -> "demo"
 *   localhost:3000             -> ""        (root / super-admin)
 *   yourdomain.com             -> ""
 *   www.yourdomain.com         -> ""        (reserved)
 * Returns "" when the request is on the root domain (super-admin context).
 */
export function slugFromHost(host: string | null | undefined): string {
  if (!host) return "";
  const hostname = host.toLowerCase().split(":")[0]; // drop port

  if (hostname === ROOT_HOST || hostname === `www.${ROOT_HOST}`) return "";

  const suffix = `.${ROOT_HOST}`;
  if (hostname.endsWith(suffix)) {
    const sub = hostname.slice(0, -suffix.length);
    const first = sub.split(".")[0]; // support nested just in case
    if (first === "www") return "";
    return first;
  }

  // Unknown host (e.g. a raw Vercel preview URL). Treat as root so we never
  // silently bind to the wrong tenant.
  return "";
}

export { ROOT_HOST };
