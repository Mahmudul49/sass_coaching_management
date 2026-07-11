import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StatCard from "@/components/ui/StatCard";
import { getSuperAdminStats, listTenants } from "@/lib/superadmin/queries";
import { toBnDigits } from "@/lib/format";
import { dict } from "@/lib/i18n/dictionaries";
import TenantsClient from "@/components/superadmin/TenantsClient";

export default async function SuperAdminDashboard() {
  const t = (k: keyof typeof dict.en) => dict.en[k]; // Super Admin always English
  const [stats, tenants] = await Promise.all([getSuperAdminStats(), listTenants()]);

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t("sa_nav_dashboard")}</Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t("sa_total_active")}
          value={toBnDigits(stats.totalActiveStudents, "en")}
          icon={<GroupsIcon />}
        />
        <StatCard
          label={t("sa_total_centers")}
          value={toBnDigits(stats.totalTenants, "en")}
          icon={<StorefrontIcon />}
          color="secondary.main"
        />
        <StatCard
          label={t("sa_active_centers")}
          value={toBnDigits(stats.activeTenants, "en")}
          icon={<CheckCircleIcon />}
          color="success.main"
        />
        <StatCard
          label={t("sa_total_admins")}
          value={toBnDigits(stats.totalAdmins, "en")}
          icon={<PersonIcon />}
          color="#475569"
        />
      </Stack>

      <TenantsClient
        tenants={tenants}
        rootDomain={process.env.ROOT_DOMAIN ?? "localhost:3000"}
      />
    </Stack>
  );
}
