import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import ClassesManager from "@/components/admin/ClassesManager";
import { getT } from "@/lib/i18n/server";

export default async function ClassesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const t = await getT();
  const classes = await listClasses(db);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t("nav_classes")}</Typography>
      <ClassesManager classes={classes} />
    </Stack>
  );
}
