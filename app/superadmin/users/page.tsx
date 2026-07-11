import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { listPlatformUsers } from "@/lib/superadmin/queries";
import UsersClient from "@/components/superadmin/UsersClient";

/** Platform user management — SuperAdmin only (defense-in-depth: layout also gates). */
export default async function UsersPage() {
  const { userId } = await requireSuperAdmin();
  const users = await listPlatformUsers();

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Users &amp; Roles</Typography>
      <UsersClient users={users} selfId={userId} />
    </Stack>
  );
}
