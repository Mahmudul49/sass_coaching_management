import "server-only";

import { revalidatePath } from "next/cache";
import { getTenantSlug } from "@/lib/tenant/server";
import { tenantAdminPath } from "@/lib/tenant/paths";

export async function revalidateTenantAdminLayout() {
  const slug = await getTenantSlug();
  if (slug) revalidatePath(tenantAdminPath(slug), "layout");
}

export async function revalidateTenantAdminPage(sub: string) {
  const slug = await getTenantSlug();
  if (slug) revalidatePath(tenantAdminPath(slug, sub));
}
