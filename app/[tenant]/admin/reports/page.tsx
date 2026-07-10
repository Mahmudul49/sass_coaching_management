import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import {
  listClasses,
  getDueReportPaged,
  getDueReportSummary,
  getAttendanceReport,
} from "@/lib/admin/queries";
import DueReportClient from "@/components/admin/DueReportClient";
import AttendanceReportClient from "@/components/admin/AttendanceReportClient";
import ReportTabs from "@/components/admin/ReportTabs";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { dict } from "@/lib/i18n/dictionaries";
import { currentYear, todayISO } from "@/lib/format";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    tab?: string;
    classId?: string;
    from?: string;
    to?: string;
    status?: string;
  }>;
}) {
  const { tenant } = await params;
  const ctx = await requireAdmin(tenant);
  const { db } = ctx;
  // Reports page always renders in English.
  const classes = await listClasses(db);
  const sp = await searchParams;

  const tab: "payment" | "attendance" = sp.tab === "attendance" ? "attendance" : "payment";
  const from = sp.from || `${currentYear()}-01-01`;
  const to = sp.to || todayISO();

  return (
    <I18nProvider initialLocale="en">
    <Stack spacing={2}>
      <Typography variant="h5">{dict.en.nav_reports}</Typography>
      <ReportTabs tab={tab} />

      {tab === "attendance" ? (
        await renderAttendance()
      ) : (
        await renderPayment()
      )}
    </Stack>
    </I18nProvider>
  );

  async function renderPayment() {
    const classId = sp.classId ?? "";
    const status = sp.status ?? "";
    const filter = { classId: classId || undefined, from, to, status };
    const [initial, summary] = await Promise.all([
      getDueReportPaged(db, filter),
      getDueReportSummary(db, filter),
    ]);
    return (
      <DueReportClient
        classes={classes}
        classId={classId}
        from={from}
        to={to}
        status={status}
        initial={initial}
        summary={summary}
        centerName={ctx.tenant.name}
      />
    );
  }

  async function renderAttendance() {
    // Attendance needs a specific class; default to the first.
    const classId = sp.classId || classes[0]?.id || "";
    const { rows, days } = await getAttendanceReport(db, { classId, from, to });
    const className = classes.find((c) => c.id === classId)?.name ?? "";
    return (
      <AttendanceReportClient
        classes={classes}
        classId={classId}
        from={from}
        to={to}
        days={days}
        rows={rows}
        centerName={ctx.tenant.name}
        className={className}
      />
    );
  }
}
