import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminUnread } from "@/lib/messages/queries";
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
  const unreadMessages = await getAdminUnread(tenant.id);
  return (
    <AdminShell centerName={tenant.name} unreadMessages={unreadMessages}>
      {children}
    </AdminShell>
  );
}
