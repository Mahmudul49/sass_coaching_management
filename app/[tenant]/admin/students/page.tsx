import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import {
  listStudentsPaged,
  getActiveCountsByClass,
  listClasses,
  listSections,
} from "@/lib/admin/queries";
import StudentsBrowser from "@/components/admin/StudentsBrowser";
import { getT } from "@/lib/i18n/server";

type View = "active" | "inactive" | "all";

export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ classId?: string; view?: string; q?: string }>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const { db } = await requireAdmin(tenant);
  const t = await getT();

  const classId = sp.classId?.trim() || "";
  const view: View = sp.view === "inactive" || sp.view === "all" ? sp.view : "active";
  const search = sp.q?.trim() || "";

  const [initial, activeCounts, classes, sections] = await Promise.all([
    listStudentsPaged(
      db,
      { classId: classId || undefined, status: view, search: search || undefined },
      { limit: 50 }
    ),
    getActiveCountsByClass(db),
    listClasses(db),
    listSections(db),
  ]);

  const totalActive = Object.values(activeCounts).reduce((a, b) => a + b, 0);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t("nav_students")}</Typography>
      <StudentsBrowser
        classes={classes}
        sections={sections}
        activeCounts={activeCounts}
        totalActive={totalActive}
        initial={initial}
        classId={classId}
        view={view}
        search={search}
      />
    </Stack>
  );
}
