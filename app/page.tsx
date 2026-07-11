import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantById } from "@/lib/tenant/server";
import { tenantAdminPath } from "@/lib/tenant/paths";

/**
 * Root entry — route by role (this is the app / APK start URL):
 *   - super-admin → the super-admin dashboard;
 *   - tenant admin → their own center's admin (never the super-admin area, which
 *     would 403 them);
 *   - nobody logged in → login.
 */
export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "superadmin" || role === "platform_admin") redirect("/superadmin");

  if (role === "admin" && session?.user?.tenantId) {
    const tenant = await getTenantById(session.user.tenantId);
    if (tenant) redirect(tenantAdminPath(tenant.slug));
  }

  redirect("/login");
}
