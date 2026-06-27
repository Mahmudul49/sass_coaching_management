/** Derive /{tenant}/admin base path from the current pathname. */
export function tenantAdminBaseFromPath(pathname: string): string {
  const match = pathname.match(/^\/([^/]+)\/admin/);
  return match ? `/${match[1]}/admin` : "/admin";
}
