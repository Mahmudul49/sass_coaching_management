import Link from "next/link";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import AddIcon from "@mui/icons-material/Add";
import GradingIcon from "@mui/icons-material/Grading";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PublishIcon from "@mui/icons-material/Publish";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CategoryIcon from "@mui/icons-material/Category";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import { getResultsDashboard, listExams, listSubjects } from "@/lib/results/queries";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import ExamsList from "@/components/admin/results/ExamsList";
import { tenantAdminPath } from "@/lib/tenant/paths";

export default async function ResultsDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { db } = await requireAdmin(slug);
  const base = tenantAdminPath(slug, "results");

  const [classes, subjects, dashboard, exams] = await Promise.all([
    listClasses(db),
    listSubjects(db),
    getResultsDashboard(db),
    listExams(db),
  ]);

  // Gate: results need classes + at least one subject before any exam exists.
  const needsSetup = classes.length === 0 || subjects.length === 0;

  const cards = [
    { label: "Exams in progress", value: String(dashboard.drafts), icon: <GradingIcon />, color: "#0F7A6B" },
    { label: "Pending marks", value: String(dashboard.pendingMarks), icon: <EditNoteIcon />, color: "#D97706" },
    { label: "Awaiting publish", value: String(dashboard.awaitingPublish), icon: <PendingActionsIcon />, color: "#0284C7" },
    { label: "Recently published", value: String(dashboard.recentPublished.length), icon: <PublishIcon />, color: "#16A34A" },
  ];

  return (
    <Stack spacing={2.5}>
      <PageHeader
        icon={<GradingIcon />}
        title="Results"
        subtitle="Exams, marks, grades & certificates"
        actions={
          <>
            <Button component={Link} href={`${base}/reports`} variant="outlined" color="inherit" startIcon={<AssessmentIcon />}>
              Reports
            </Button>
            <Button component={Link} href={`${base}/subjects`} variant="outlined" color="inherit" startIcon={<CategoryIcon />}>
              Subjects
            </Button>
            <Button component={Link} href={`${base}/settings`} variant="outlined" color="inherit" startIcon={<SettingsIcon />}>
              Settings
            </Button>
            {!needsSetup && (
              <Button component={Link} href={`${base}/new`} startIcon={<AddIcon />}>
                Create Exam
              </Button>
            )}
          </>
        }
      />

      {needsSetup ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            icon={<CategoryIcon fontSize="inherit" />}
            title={classes.length === 0 ? "Create classes first" : "Add subjects first"}
            description={
              classes.length === 0
                ? "You need classes and students before running an exam."
                : "Add the subjects taught in each class, then create your first exam."
            }
            actionLabel={classes.length === 0 ? undefined : "Add subjects"}
          />
          {classes.length > 0 && (
            <Box sx={{ textAlign: "center", pb: 2 }}>
              <Button component={Link} href={`${base}/subjects`} startIcon={<AddIcon />}>
                Add subjects
              </Button>
            </Box>
          )}
        </Card>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
            }}
          >
            {cards.map((c) => (
              <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} color={c.color} />
            ))}
          </Box>

          <ExamsList base={base} exams={exams} />
        </>
      )}
    </Stack>
  );
}
