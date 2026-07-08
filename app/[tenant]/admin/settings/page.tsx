import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import SettingsClient from "@/components/admin/SettingsClient";

export default async function SettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await requireAdmin(slug);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">সেটিংস</Typography>
      <SettingsClient
        centerName={ctx.tenant.name}
        adminName={ctx.name}
        attendanceSmsEnabled={ctx.tenant.attendanceSmsEnabled}
      />
    </Stack>
  );
}
