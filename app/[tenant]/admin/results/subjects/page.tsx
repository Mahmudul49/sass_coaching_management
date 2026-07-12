import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import { listSubjects } from "@/lib/results/queries";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import SubjectsManager from "@/components/admin/results/SubjectsManager";

export default async function SubjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { db } = await requireAdmin(slug);
  const [classes, subjects] = await Promise.all([listClasses(db), listSubjects(db)]);

  return (
    <Stack spacing={2}>
      <PageHeader title="Subjects" subtitle="Subjects taught in each class" />
      {classes.length === 0 ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            title="Create classes first"
            description="Add classes before defining their subjects."
          />
        </Card>
      ) : (
        <SubjectsManager classes={classes} subjects={subjects} />
      )}
    </Stack>
  );
}
