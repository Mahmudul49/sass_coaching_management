import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import { listSubjects } from "@/lib/results/queries";
import { getExamSettings } from "@/lib/results/settings";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ExamSetupForm from "@/components/admin/results/ExamSetupForm";
import ResultsWorkflow from "@/components/admin/results/ResultsWorkflow";
import { tenantAdminPath } from "@/lib/tenant/paths";

export default async function NewExamPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { db } = await requireAdmin(slug);
  const [classes, subjects, settings] = await Promise.all([
    listClasses(db),
    listSubjects(db),
    getExamSettings(db),
  ]);
  const base = tenantAdminPath(slug, "results");

  return (
    <Stack spacing={2}>
      <PageHeader title="Create Exam" subtitle="Set up an exam, then enter marks" />
      <ResultsWorkflow active={0} />
      {classes.length === 0 || subjects.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            title={classes.length === 0 ? "Create classes first" : "Add subjects first"}
            description="You need classes and their subjects before creating an exam."
          />
        </Card>
      ) : (
        <ExamSetupForm
          base={base}
          classes={classes}
          subjects={subjects}
          examTypes={settings.examTypes}
          defaultTotalMarks={settings.defaultTotalMarks}
          defaultPassMarks={settings.defaultPassMarks}
        />
      )}
    </Stack>
  );
}
