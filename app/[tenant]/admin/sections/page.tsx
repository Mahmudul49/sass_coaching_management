import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, listSections } from "@/lib/admin/queries";
import SectionsManager from "@/components/admin/SectionsManager";
import { getT } from "@/lib/i18n/server";

export default async function SectionsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const t = await getT();
  const [classes, sections] = await Promise.all([listClasses(db), listSections(db)]);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t("nav_sections")}</Typography>
      <SectionsManager classes={classes} sections={sections} />
    </Stack>
  );
}
