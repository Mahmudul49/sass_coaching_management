import { NextResponse, type NextRequest } from "next/server";
import { slugFromHost } from "@/lib/tenant/host";

/**
 * Tenant resolution at the edge.
 *
 * The MongoDB driver cannot run on the Edge runtime, so this middleware does
 * the *pure* part of tenant resolution — parsing the subdomain slug from the
 * Host header — and forwards it to server components/handlers via the
 * `x-tenant-slug` request header.
 *
 * DB-backed validation (does this slug exist? is the tenant active? does the
 * logged-in admin's session.tenantId match this subdomain?) happens in
 * `lib/tenant/server.ts` (`requireTenant`) which runs in the Node runtime where
 * Mongo is available. An unknown slug there triggers `notFound()` (404), and a
 * session/subdomain mismatch triggers a 403 — never a fallback to a default
 * tenant.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  const slug = slugFromHost(host);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-slug", slug);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
