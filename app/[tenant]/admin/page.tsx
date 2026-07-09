import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import PaidIcon from "@mui/icons-material/Paid";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import TodayIcon from "@mui/icons-material/Today";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getSetupStatus,
  getDashboardStats,
  listStudents,
  listClasses,
  listSections,
} from "@/lib/admin/queries";
import LinearProgress from "@mui/material/LinearProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import StatCard from "@/components/ui/StatCard";
import SetupChecklist from "@/components/admin/SetupChecklist";
import StudentsManager from "@/components/admin/StudentsManager";
import MonthlyCollectionChart from "@/components/admin/MonthlyCollectionChart";
import QuickActions from "@/components/admin/QuickActions";
import { getT } from "@/lib/i18n/server";
import { tenantAdminPath } from "@/lib/tenant/paths";
import { taka, currentMonth, currentYear, monthName, toBnDigits } from "@/lib/format";

export default async function AdminDashboard({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db } = await requireAdmin(tenant);
  const t = await getT();
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

  const cards = [
    { label: t("active_students"), value: toBnDigits(stats.activeStudents), icon: <GroupsIcon />, color: "#0F7A6B" },
    { label: t("today_collection"), value: taka(stats.todayCollection), icon: <TodayIcon />, color: "#0284C7" },
    { label: t("month_collection"), value: taka(stats.monthCollection), icon: <PaidIcon />, color: "#16A34A" },
    { label: t("month_due"), value: taka(stats.monthDue), icon: <MoneyOffIcon />, color: "#DC2626" },
    { label: t("year_collection"), value: taka(stats.yearCollection), icon: <AccountBalanceWalletIcon />, color: "#7C3AED" },
    { label: t("year_due"), value: taka(stats.yearDue), icon: <CalendarMonthIcon />, color: "#B45309" },
  ];

  const monthPayable = stats.monthCollection + stats.monthDue;
  const monthPct = monthPayable > 0 ? Math.round((stats.monthCollection / monthPayable) * 100) : 0;

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5">{t("nav_dashboard")}</Typography>

      <QuickActions base={tenantAdminPath(tenant)} />

      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>
        {t("financial_summary")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            lg: "repeat(6, 1fr)",
          },
        }}
      >
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} color={c.color} />
        ))}
      </Box>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {monthName(month)} মাসের আদায় অগ্রগতি
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {toBnDigits(monthPct)}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={monthPct}
            color="success"
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography variant="caption" color="success.main">
              আদায়: {taka(stats.monthCollection)}
            </Typography>
            <Typography variant="caption" color="error.main">
              বকেয়া: {taka(stats.monthDue)}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <MonthlyCollectionChart monthly={stats.monthly} year={year} currentMonth={month} />

      {!status.complete && <SetupChecklist status={status} />}

      <StudentsManager students={students} classes={classes} sections={sections} />
    </Stack>
  );
}
