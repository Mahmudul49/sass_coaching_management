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
import DashboardIcon from "@mui/icons-material/Dashboard";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getSetupStatus,
  getDashboardStats,
  getActiveCountsByClass,
  listClasses,
} from "@/lib/admin/queries";
import LinearProgress from "@mui/material/LinearProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import StatCard from "@/components/ui/StatCard";
import SetupChecklist from "@/components/admin/SetupChecklist";
import StudentsOverview from "@/components/admin/StudentsOverview";
import MonthlyCollectionChart from "@/components/admin/MonthlyCollectionChart";
import QuickActions from "@/components/admin/QuickActions";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { dict, type MessageKey } from "@/lib/i18n/dictionaries";
import { tenantAdminPath } from "@/lib/tenant/paths";
import { taka, currentMonth, currentYear, monthName, toBnDigits } from "@/lib/format";

export default async function AdminDashboard({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { db, tenant: center } = await requireAdmin(tenant);
  // The dashboard is always rendered in English (labels, numbers, currency and
  // month names), independent of the app-wide language toggle. `t` reads the
  // English catalogue directly and the whole subtree is wrapped in an English
  // I18nProvider below so client children (quick actions, students table, etc.)
  // render in English too.
  const t = (k: MessageKey) => dict.en[k] ?? k;
  const status = await getSetupStatus(db);

  // First run: no classes yet -> jump straight into the guided wizard.
  if (!status.hasClasses) redirect(tenantAdminPath(tenant, "setup"));

  const year = currentYear();
  const month = currentMonth();
  // Scale note: the dashboard shows an aggregate students overview (per-class
  // active counts) instead of loading every student row — full management lives
  // on the paginated /students page. Keeps the landing payload constant at 100k+.
  const [stats, activeCounts, classes] = await Promise.all([
    getDashboardStats(db, year, month),
    getActiveCountsByClass(db),
    listClasses(db),
  ]);
  const totalActive = Object.values(activeCounts).reduce((a, b) => a + b, 0);

  const cards = [
    { label: t("active_students"), value: toBnDigits(totalActive, "en"), icon: <GroupsIcon />, color: "#0F7A6B" },
    { label: t("today_collection"), value: taka(stats.todayCollection, "en"), icon: <TodayIcon />, color: "#0284C7" },
    { label: t("month_collection"), value: taka(stats.monthCollection, "en"), icon: <PaidIcon />, color: "#16A34A" },
    { label: t("month_due"), value: taka(stats.monthDue, "en"), icon: <MoneyOffIcon />, color: "#DC2626" },
    { label: t("year_collection"), value: taka(stats.yearCollection, "en"), icon: <AccountBalanceWalletIcon />, color: "#7C3AED" },
    { label: t("year_due"), value: taka(stats.yearDue, "en"), icon: <CalendarMonthIcon />, color: "#B45309" },
  ];

  const monthPayable = stats.monthCollection + stats.monthDue;
  const monthPct = monthPayable > 0 ? Math.round((stats.monthCollection / monthPayable) * 100) : 0;

  return (
    <I18nProvider initialLocale="en">
    <Stack spacing={2.5}>
      <PageHeader
        icon={<DashboardIcon />}
        title={t("nav_dashboard")}
        subtitle={`${center.name} · ${monthName(month, "en")} ${year}`}
      />

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
              {monthName(month, "en")} {t("dash_progress_suffix")}
            </Typography>
            <Typography variant="body2" fontWeight={700}>
              {toBnDigits(monthPct, "en")}%
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
              {t("dash_collected")}: {taka(stats.monthCollection, "en")}
            </Typography>
            <Typography variant="caption" color="error.main">
              {t("dash_due")}: {taka(stats.monthDue, "en")}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <MonthlyCollectionChart monthly={stats.monthly} year={year} currentMonth={month} />

      {!status.complete && <SetupChecklist status={status} />}

      <StudentsOverview
        classes={classes}
        activeCounts={activeCounts}
        totalActive={totalActive}
        studentsPath={tenantAdminPath(tenant, "students")}
      />
    </Stack>
    </I18nProvider>
  );
}
