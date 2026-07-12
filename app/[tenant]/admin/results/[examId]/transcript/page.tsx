import { notFound } from "next/navigation";
import Link from "next/link";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { requireAdmin } from "@/lib/auth/guards";
import { getExam, buildTranscripts } from "@/lib/results/queries";
import { getExamSettings } from "@/lib/results/settings";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import TranscriptClient from "@/components/admin/results/TranscriptClient";
import { tenantAdminPath } from "@/lib/tenant/paths";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ tenant: string; examId: string }>;
}) {
  const { tenant: slug, examId } = await params;
  const { db, tenant } = await requireAdmin(slug);
  const exam = await getExam(db, examId);
  if (!exam) notFound();

  const base = tenantAdminPath(slug, "results");

  // Transcripts are issued for published results only.
  if (exam.status !== "published") {
    return (
      <Stack spacing={2}>
        <PageHeader title="Transcripts" subtitle={exam.name} />
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="Publish results first"
            description="Transcripts become available once this exam's results are published."
          />
          <Box sx={{ textAlign: "center", pb: 2 }}>
            <Button component={Link} href={`${base}/${examId}`} startIcon={<ArrowBackIcon />}>
              Back to results
            </Button>
          </Box>
        </Card>
      </Stack>
    );
  }

  const [{ grading, rows }, settings] = await Promise.all([
    buildTranscripts(db, exam),
    getExamSettings(db),
  ]);
  const year = exam.date.slice(0, 4);
  const title = `${exam.examType} ${settings.certificateTitle} - ${year}`.trim();

  return (
    <Stack spacing={2}>
      <PageHeader title="Transcripts" subtitle={`${exam.name} · ${exam.className}`} />
      <TranscriptClient
        centerName={tenant.name}
        title={title}
        examName={exam.name}
        grading={grading}
        rows={rows}
      />
    </Stack>
  );
}
