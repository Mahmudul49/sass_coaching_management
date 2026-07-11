import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requirePermission } from "@/lib/auth/guards";
import { getConsoleTheme } from "@/lib/superadmin/theme";
import ThemeBuilderClient from "@/components/superadmin/ThemeBuilderClient";

/** Theme Builder — SuperAdmin only (theme:manage). */
export default async function ThemePage() {
  await requirePermission("theme:manage");
  const theme = await getConsoleTheme();

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h5">Theme Builder</Typography>
        <Typography variant="body2" color="text.secondary">
          Customize the console color palette. Changes apply across the admin console for both
          light and dark mode.
        </Typography>
      </Stack>
      <ThemeBuilderClient initial={theme} />
    </Stack>
  );
}
