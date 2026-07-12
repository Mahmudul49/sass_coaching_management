import Stack from "@mui/material/Stack";
import { requireAdmin } from "@/lib/auth/guards";
import { getExamSettings } from "@/lib/results/settings";
import PageHeader from "@/components/ui/PageHeader";
import ExamSettingsClient from "@/components/admin/results/ExamSettingsClient";

export default async function ResultsSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { db } = await requireAdmin(slug);
  const settings = await getExamSettings(db);

  return (
    <Stack spacing={2}>
      <PageHeader title="Results Settings" subtitle="Grading scale, pass rule, defaults & certificate" />
      <ExamSettingsClient settings={settings} />
    </Stack>
  );
}
