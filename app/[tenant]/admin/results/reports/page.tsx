import Stack from "@mui/material/Stack";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import { listExams, listSubjects, getResultsReport } from "@/lib/results/queries";
import PageHeader from "@/components/ui/PageHeader";
import ResultsReportClient from "@/components/admin/results/ResultsReportClient";
import { currentYear, todayISO } from "@/lib/format";

export default async function ResultsReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { db, tenant } = await requireAdmin(slug);

  const from = `${currentYear()}-01-01`;
  const to = todayISO();
  const [classes, subjects, exams, initial] = await Promise.all([
    listClasses(db),
    listSubjects(db),
    listExams(db, { status: "published" }),
    getResultsReport(db, { from, to, status: "published" }),
  ]);

  return (
    <Stack spacing={2}>
      <PageHeader title="Results Reports" subtitle="Search, filter and export published results" />
      <ResultsReportClient
        centerName={tenant.name}
        classes={classes}
        subjects={subjects}
        exams={exams}
        from={from}
        to={to}
        initial={initial}
      />
    </Stack>
  );
}
