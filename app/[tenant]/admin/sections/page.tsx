import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, listSections } from "@/lib/admin/queries";
import SectionsManager from "@/components/admin/SectionsManager";

export default async function SectionsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const [classes, sections] = await Promise.all([listClasses(db), listSections(db)]);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">শাখা ব্যবস্থাপনা</Typography>
      <SectionsManager classes={classes} sections={sections} />
    </Stack>
  );
}
