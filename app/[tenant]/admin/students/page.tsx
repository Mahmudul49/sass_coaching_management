import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listStudents, listClasses, listSections } from "@/lib/admin/queries";
import StudentsManager from "@/components/admin/StudentsManager";
import { getT } from "@/lib/i18n/server";

export default async function StudentsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const t = await getT();
  const [students, classes, sections] = await Promise.all([
    listStudents(db),
    listClasses(db),
    listSections(db),
  ]);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t("nav_students")}</Typography>
      <StudentsManager students={students} classes={classes} sections={sections} />
    </Stack>
  );
}
