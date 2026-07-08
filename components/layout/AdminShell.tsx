"use client";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ClassIcon from "@mui/icons-material/Class";
import CategoryIcon from "@mui/icons-material/Category";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GroupsIcon from "@mui/icons-material/Groups";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import PaidIcon from "@mui/icons-material/Paid";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import SchoolIcon from "@mui/icons-material/School";
import LogoutButton from "./LogoutButton";
import { tenantAdminBaseFromPath } from "./tenantAdminBase";

const DRAWER_WIDTH = 256;

export default function AdminShell({
  centerName,
  children,
}: {
  centerName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = tenantAdminBaseFromPath(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = useMemo(
    () => [
      { href: base, label: "ড্যাশবোর্ড", icon: <DashboardIcon />, primary: true },
      { href: `${base}/students`, label: "শিক্ষার্থী", icon: <GroupsIcon />, primary: true },
      { href: `${base}/attendance`, label: "উপস্থিতি", icon: <FactCheckIcon />, primary: true },
      { href: `${base}/payments`, label: "পেমেন্ট", icon: <PaidIcon />, primary: true },
      { href: `${base}/reports`, label: "রিপোর্ট", icon: <AssessmentIcon />, primary: true },
      { href: `${base}/classes`, label: "ক্লাস", icon: <ClassIcon /> },
      { href: `${base}/sections`, label: "শাখা", icon: <CategoryIcon /> },
      { href: `${base}/fees`, label: "ফি স্ট্রাকচার", icon: <ReceiptLongIcon /> },
      { href: `${base}/settings`, label: "সেটিংস", icon: <SettingsIcon /> },
    ],
    [base]
  );
  const primary = nav.filter((n) => n.primary);

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  // Value for the bottom nav: the matched primary href, else false.
  const bottomValue = primary.find((p) => isActive(p.href))?.href ?? false;

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ gap: 1 }}>
        <SchoolIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={800} noWrap>
          {centerName}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, py: 1, px: 1 }}>
        {nav.map((item) => (
          <ListItem key={item.href} disablePadding>
            <ListItemButton
              component={NextLink}
              href={item.href}
              selected={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.5,
                minHeight: 48,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "& .MuiListItemIcon-root": { color: "#fff" },
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="primary" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="মেনু"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <SchoolIcon sx={{ mr: 1, display: { xs: "none", md: "block" } }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }} noWrap>
            {centerName}
          </Typography>
          <LogoutButton />
        </Toolbar>
      </AppBar>

      {/* Mobile hamburger drawer: full nav */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop persistent sidebar */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: "1px solid rgba(18,36,31,0.08)" },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}
      >
        <Toolbar />
        <Box
          sx={{
            p: { xs: 1.5, sm: 2.5, md: 3 },
            pb: { xs: 11, md: 3 }, // clear the mobile bottom nav
            maxWidth: { md: 1180 },
            mx: "auto",
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Mobile bottom navigation: 5 primary destinations */}
      <Paper
        elevation={3}
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <BottomNavigation value={bottomValue} showLabels sx={{ height: 64 }}>
          {primary.map((item) => (
            <BottomNavigationAction
              key={item.href}
              component={NextLink}
              href={item.href}
              value={item.href}
              label={item.label}
              icon={item.icon}
              sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontSize: "0.7rem" } }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
