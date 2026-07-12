import Stack from "@mui/material/Stack";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { requireAdmin } from "@/lib/auth/guards";
import { getThread } from "@/lib/messages/queries";
import { getT, getLocale } from "@/lib/i18n/server";
import PageHeader from "@/components/ui/PageHeader";
import AdminChat from "@/components/messages/AdminChat";

/**
 * Admin ↔ Super Admin conversation. An admin has exactly ONE conversation (with
 * the Super Admin), scoped to their own tenant by requireAdmin().
 */
export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAdmin(slug);
  const [initial, t, locale] = await Promise.all([
    getThread(tenant.id, "admin", {}),
    getT(),
    getLocale(),
  ]);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        icon={<ForumOutlinedIcon />}
        title={t("nav_messages")}
        subtitle={locale === "bn" ? "সুপার অ্যাডমিনের সাথে চ্যাট" : "Chat with the Super Admin"}
      />
      <AdminChat initial={initial} />
    </Stack>
  );
}
