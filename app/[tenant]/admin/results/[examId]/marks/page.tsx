import { notFound, redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { getExam, buildMarkEntry } from "@/lib/results/queries";
import { getExamSettings } from "@/lib/results/settings";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ResultsWorkflow from "@/components/admin/results/ResultsWorkflow";
import MarkEntryClient from "@/components/admin/results/MarkEntryClient";
import { tenantAdminPath } from "@/lib/tenant/paths";

export default async function MarkEntryPage({
  params,
}: {
  params: Promise<{ tenant: string; examId: string }>;
}) {
  const { tenant: slug, examId } = await params;
  const { db } = await requireAdmin(slug);
  const exam = await getExam(db, examId);
  if (!exam) notFound();

  const base = tenantAdminPath(slug, "results");
  // Published results are locked — send the admin to the read-only results view.
  if (exam.status === "published") redirect(`${base}/${examId}`);

  const [{ subjects, rows }, settings] = await Promise.all([
    buildMarkEntry(db, exam),
    getExamSettings(db),
  ]);

  return (
    <Stack spacing={2}>
      <PageHeader
        title={exam.name}
        subtitle={`${exam.className} · ${exam.examType} · ${exam.date}`}
      />
      <ResultsWorkflow active={1} />
      {rows.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="No active students in this class"
            description="Add students to this class, then enter their marks."
          />
        </Card>
      ) : (
        <MarkEntryClient
          base={base}
          examId={exam.id}
          totalMarks={exam.totalMarks}
          passMarks={exam.passMarks}
          subjects={subjects}
          rows={rows}
          gradingScale={settings.gradingScale}
          passRule={settings.passRule}
        />
      )}
    </Stack>
  );
}
