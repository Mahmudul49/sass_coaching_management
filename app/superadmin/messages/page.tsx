import Stack from "@mui/material/Stack";
import ForumIcon from "@mui/icons-material/Forum";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { listConversationsForSuper, listMessageableTenants } from "@/lib/messages/queries";
import PageHeader from "@/components/ui/PageHeader";
import MessagesInbox from "@/components/messages/MessagesInbox";

/** Super-Admin messaging inbox — every tenant conversation, plus compose/broadcast. */
export default async function SuperMessagesPage() {
  await requireSuperAdmin(); // superadmin only (platform_admin is 403'd)
  const [initial, tenants] = await Promise.all([
    listConversationsForSuper({}, { skip: 0 }),
    listMessageableTenants(),
  ]);

  const subtitle =
    `${initial.total} conversation${initial.total === 1 ? "" : "s"}` +
    (initial.totalUnread ? ` · ${initial.totalUnread} unread` : "");

  return (
    <Stack spacing={2.5}>
      <PageHeader icon={<ForumIcon />} title="Messages" subtitle={subtitle} />
      <MessagesInbox initial={initial} tenants={tenants} />
    </Stack>
  );
}
