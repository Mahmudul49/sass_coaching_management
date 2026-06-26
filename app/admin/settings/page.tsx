import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import SettingsClient from "@/components/admin/SettingsClient";

export default async function SettingsPage() {
  const { tenant } = await requireAdmin();
  return (
    <Stack spacing={2}>
      <Typography variant="h5">সেটিংস</Typography>
      <SettingsClient
        centerName={tenant.name}
        attendanceSmsEnabled={tenant.attendanceSmsEnabled}
      />
    </Stack>
  );
}
