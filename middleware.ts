import { NextResponse, type NextRequest } from "next/server";
import { slugFromPath } from "@/lib/tenant/paths";

/**
 * Tenant resolution at the edge — path-based.
 *
 * Parses the first URL segment as the tenant slug (unless it is a reserved
 * root route like /superadmin or /login) and forwards it to server code via
 * the `x-tenant-slug` request header.
 *
 * DB-backed validation still happens in `lib/tenant/server.ts` (`requireTenant`).
 */
export function middleware(req: NextRequest) {
  const slug = slugFromPath(req.nextUrl.pathname);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-slug", slug);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
