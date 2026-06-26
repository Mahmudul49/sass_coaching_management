import { redirect, notFound } from "next/navigation";
import { getTenantSlug, getTenantBySlug } from "@/lib/tenant/server";

/**
 * Root entry. Sends the visitor to the correct area:
 *  - Root domain  -> /superadmin (which redirects to /login if not authed)
 *  - Subdomain    -> /admin (404 first if the tenant slug is unknown)
 */
export default async function Home() {
  const slug = await getTenantSlug();

  if (!slug) redirect("/superadmin");

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  redirect("/admin");
}
