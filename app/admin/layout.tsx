import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import AdminShell from "@/components/layout/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { tenant } = await requireAdmin(); // 404 unknown subdomain / 403 wrong tenant
  return <AdminShell centerName={tenant.name}>{children}</AdminShell>;
}
