import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses, getDueReport } from "@/lib/admin/queries";
import DueReportClient from "@/components/admin/DueReportClient";
import { currentYear, todayISO } from "@/lib/format";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ classId?: string; from?: string; to?: string; status?: string }>;
}) {
  const { tenant } = await params;
  const ctx = await requireAdmin(tenant);
  const { db } = ctx;
  const classes = await listClasses(db);
  const sp = await searchParams;

  const classId = sp.classId ?? "";
  const status = sp.status ?? "";
  // Default range: 1 Jan of the current year → today.
  const from = sp.from || `${currentYear()}-01-01`;
  const to = sp.to || todayISO();

  const rows = await getDueReport(db, { classId: classId || undefined, from, to, status });

  return (
    <Stack spacing={2}>
      <Typography variant="h5">রিপোর্ট</Typography>
      <DueReportClient
        classes={classes}
        classId={classId}
        from={from}
        to={to}
        status={status}
        rows={rows}
        centerName={ctx.tenant.name}
      />
    </Stack>
  );
}
