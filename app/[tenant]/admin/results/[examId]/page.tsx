import { notFound } from "next/navigation";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { getExam, computeExamResults } from "@/lib/results/queries";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ResultsWorkflow from "@/components/admin/results/ResultsWorkflow";
import ResultsClient from "@/components/admin/results/ResultsClient";
import { tenantAdminPath } from "@/lib/tenant/paths";

export default async function ResultsReviewPage({
  params,
}: {
  params: Promise<{ tenant: string; examId: string }>;
}) {
  const { tenant: slug, examId } = await params;
  const { db } = await requireAdmin(slug);
  const exam = await getExam(db, examId);
  if (!exam) notFound();

  const base = tenantAdminPath(slug, "results");
  const { subjects, rows } = await computeExamResults(db, exam);

  return (
    <Stack spacing={2}>
      <PageHeader
        title={exam.name}
        subtitle={`${exam.className} · ${exam.examType} · ${exam.date}`}
      />
      <ResultsWorkflow active={exam.status === "published" ? 3 : 2} />
      {rows.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState title="No students to show" description="Add students to this class first." />
        </Card>
      ) : (
        <ResultsClient base={base} exam={exam} subjects={subjects} rows={rows} />
      )}
    </Stack>
  );
}
