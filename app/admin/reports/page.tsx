import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, getDueReport } from "@/lib/admin/queries";
import DueReportClient from "@/components/admin/DueReportClient";
import { currentMonth, currentYear } from "@/lib/format";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; year?: string; month?: string; status?: string }>;
}) {
  const { db } = await requireAdmin();
  const classes = await listClasses(db);
  const sp = await searchParams;
  const classId = sp.classId ?? "";
  const year = Number(sp.year) || currentYear();
  const month = Number(sp.month) || currentMonth();
  const status = sp.status ?? "";

  const rows = await getDueReport(db, { classId: classId || undefined, year, month, status });

  return (
    <Stack spacing={2}>
      <Typography variant="h5">বকেয়া রিপোর্ট</Typography>
      <DueReportClient
        classes={classes}
        classId={classId}
        year={year}
        month={month}
        status={status}
        rows={rows}
      />
    </Stack>
  );
}
