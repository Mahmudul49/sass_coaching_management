import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import AdminShell from "@/components/layout/AdminShell";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAdmin(slug);
  return <AdminShell centerName={tenant.name}>{children}</AdminShell>;
}
