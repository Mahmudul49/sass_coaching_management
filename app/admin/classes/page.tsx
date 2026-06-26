import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listClasses } from "@/lib/admin/queries";
import ClassesManager from "@/components/admin/ClassesManager";

export default async function ClassesPage() {
  const { db } = await requireAdmin();
  const classes = await listClasses(db);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">ক্লাস ব্যবস্থাপনা</Typography>
      <ClassesManager classes={classes} />
    </Stack>
  );
}
