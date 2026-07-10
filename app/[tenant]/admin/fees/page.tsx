import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listFees } from "@/lib/admin/queries";
import FeesManager from "@/components/admin/FeesManager";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { dict } from "@/lib/i18n/dictionaries";

export default async function FeesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  // Fee Structure page always renders in English.
  const fees = await listFees(db);
  return (
    <I18nProvider initialLocale="en">
    <Stack spacing={2}>
      <Typography variant="h5">{dict.en.nav_fees}</Typography>
      <FeesManager fees={fees} />
    </Stack>
    </I18nProvider>
  );
}
