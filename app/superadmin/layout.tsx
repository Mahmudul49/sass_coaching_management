import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { requireSuperAdmin } from "@/lib/auth/guards";
import LogoutButton from "@/components/layout/LogoutButton";
import LanguageToggle from "@/components/layout/LanguageToggle";
import SuperAdminNav from "@/components/superadmin/SuperAdminNav";
import { getT } from "@/lib/i18n/server";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin(); // redirects to /login or 403s
  const t = await getT();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <AdminPanelSettingsIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t("superadmin")}
          </Typography>
          <LanguageToggle />
          <LogoutButton />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <SuperAdminNav />
        {children}
      </Container>
    </Box>
  );
}
