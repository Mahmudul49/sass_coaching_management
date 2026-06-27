import { redirect, notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant/server";
import { tenantAdminPath } from "@/lib/tenant/paths";

/** Tenant landing: /{tenant} -> /{tenant}/admin (404 if slug unknown). */
export default async function TenantHome({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  redirect(tenantAdminPath(slug));
}
