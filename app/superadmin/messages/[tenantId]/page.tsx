import { notFound } from "next/navigation";
import Stack from "@mui/material/Stack";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getTenantById } from "@/lib/tenant/server";
import { getThread } from "@/lib/messages/queries";
import SuperChat from "@/components/messages/SuperChat";

/** Super-Admin conversation with a single coaching center. */
export default async function SuperConversationPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireSuperAdmin();
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const initial = await getThread(tenant.id, "superadmin", {});

  return (
    <Stack spacing={2}>
      <SuperChat
        tenantId={tenant.id}
        tenantName={tenant.name}
        tenantActive={tenant.active}
        initial={initial}
      />
    </Stack>
  );
}
