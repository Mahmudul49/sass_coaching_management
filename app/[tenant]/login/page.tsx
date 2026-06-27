import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTenantBySlug } from "@/lib/tenant/server";
import { tenantAdminPath } from "@/lib/tenant/paths";
import LoginForm from "@/components/auth/LoginForm";

export default async function TenantLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const session = await auth();
  if (session?.user?.role === "admin" && session.user.tenantId === tenant.id) {
    redirect(tenantAdminPath(slug));
  }

  return (
    <LoginForm
      slug={slug}
      title={tenant.name}
      subtitle="অ্যাডমিন লগইন করুন"
    />
  );
}
