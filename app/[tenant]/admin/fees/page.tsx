import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requireAdmin } from "@/lib/auth/guards";
import { listFees } from "@/lib/admin/queries";
import FeesManager from "@/components/admin/FeesManager";

export default async function FeesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const fees = await listFees(db);
  return (
    <Stack spacing={2}>
      <Typography variant="h5">ফি স্ট্রাকচার</Typography>
      <FeesManager fees={fees} />
    </Stack>
  );
}
