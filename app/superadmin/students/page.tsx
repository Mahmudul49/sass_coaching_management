import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { listTenants, searchMarketingStudents } from "@/lib/superadmin/queries";
import StudentsMarketingClient from "@/components/superadmin/StudentsMarketingClient";

export default async function SuperAdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tenantId?: string; activeOnly?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const tenantId = sp.tenantId ?? "";
  const activeOnly = sp.activeOnly !== "0";

  const [{ rows, total }, tenants] = await Promise.all([
    searchMarketingStudents({ query, tenantId: tenantId || undefined, activeOnly }),
    listTenants(),
  ]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">মার্কেটিং — শিক্ষার্থী তথ্য</Typography>
      <StudentsMarketingClient
        rows={rows}
        total={total}
        tenants={tenants}
        query={query}
        tenantId={tenantId}
        activeOnly={activeOnly}
      />
    </Stack>
  );
}
