import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlug, getTenantBySlug } from "@/lib/tenant/server";
import LoginForm from "@/components/auth/LoginForm";

/**
 * Shared login page.
 *  - Root domain (no slug): super-admin login.
 *  - Subdomain: that tenant's admin login (404 if the slug doesn't exist).
 * If already logged in, bounce to the right home.
 */
export default async function LoginPage() {
  const slug = await getTenantSlug();
  const session = await auth();

  if (slug) {
    const tenant = await getTenantBySlug(slug);
    if (!tenant) notFound();
    if (session?.user?.role === "admin" && session.user.tenantId === tenant.id) {
      redirect("/admin");
    }
    return (
      <LoginForm
        slug={slug}
        title={tenant.name}
        subtitle="অ্যাডমিন লগইন করুন"
      />
    );
  }

  if (session?.user?.role === "superadmin") redirect("/superadmin");
  return (
    <LoginForm
      slug=""
      title="কোচিং ম্যানেজমেন্ট"
      subtitle="সুপার অ্যাডমিন লগইন"
    />
  );
}
