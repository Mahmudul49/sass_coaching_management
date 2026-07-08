import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import PaidIcon from "@mui/icons-material/Paid";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getSetupStatus,
  getDashboardStats,
  listStudents,
  listClasses,
  listSections,
} from "@/lib/admin/queries";
import StatCard from "@/components/ui/StatCard";
import SetupChecklist from "@/components/admin/SetupChecklist";
import StudentsManager from "@/components/admin/StudentsManager";
import { tenantAdminPath } from "@/lib/tenant/paths";
import { taka, currentMonth, currentYear, monthName, toBnDigits } from "@/lib/format";

export default async function AdminDashboard({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const status = await getSetupStatus(db);

  // First run: no classes yet -> jump straight into the guided wizard.
  if (!status.hasClasses) redirect(tenantAdminPath(tenant, "setup"));

  const year = currentYear();
  const month = currentMonth();
  const [stats, students, classes, sections] = await Promise.all([
    getDashboardStats(db, year, month),
    listStudents(db),
    listClasses(db),
    listSections(db),
  ]);

  return (
    <Stack spacing={3}>
      <Typography variant="h5">ড্যাশবোর্ড</Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap flexWrap="wrap">
        <StatCard label="সক্রিয় শিক্ষার্থী" value={toBnDigits(stats.activeStudents)} icon={<GroupsIcon />} />
        <StatCard
          label={`${monthName(month)} মাসের আদায়`}
          value={taka(stats.collection)}
          icon={<PaidIcon />}
          color="success.main"
        />
        <StatCard
          label={`${monthName(month)} মাসের বকেয়া`}
          value={taka(stats.due)}
          icon={<MoneyOffIcon />}
          color="error.main"
        />
      </Stack>

      {!status.complete && <SetupChecklist status={status} />}

      <StudentsManager students={students} classes={classes} sections={sections} />
    </Stack>
  );
}
