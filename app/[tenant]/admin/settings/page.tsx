import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import SettingsClient from "@/components/admin/SettingsClient";
import { I18nProvider } from "@/components/providers/I18nProvider";

export default async function SettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const ctx = await requireAdmin(slug);
  return (
    <I18nProvider initialLocale="en">
    <Stack spacing={2}>
      <Typography variant="h5">Settings</Typography>
      <SettingsClient
        centerName={ctx.tenant.name}
        adminName={ctx.name}
        attendanceSmsEnabled={ctx.tenant.attendanceSmsEnabled}
      />
    </Stack>
    </I18nProvider>
  );
}
