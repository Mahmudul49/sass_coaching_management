"use client";
import { useState, type ReactNode } from "react";
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
import Toolbar2 from "@mui/material/Toolbar";
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

const DRAWER_WIDTH = 248;

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: <DashboardIcon /> },
  { href: "/admin/classes", label: "ক্লাস", icon: <ClassIcon /> },
  { href: "/admin/sections", label: "শাখা", icon: <CategoryIcon /> },
  { href: "/admin/fees", label: "ফি স্ট্রাকচার", icon: <ReceiptLongIcon /> },
  { href: "/admin/students", label: "ছাত্র", icon: <GroupsIcon /> },
  { href: "/admin/attendance", label: "উপস্থিতি", icon: <FactCheckIcon /> },
  { href: "/admin/payments", label: "পেমেন্ট", icon: <PaidIcon /> },
  { href: "/admin/reports", label: "বকেয়া রিপোর্ট", icon: <AssessmentIcon /> },
  { href: "/admin/settings", label: "সেটিংস", icon: <SettingsIcon /> },
];

export default function AdminShell({
  centerName,
  children,
}: {
  centerName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar2 sx={{ gap: 1 }}>
        <SchoolIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          {centerName}
        </Typography>
      </Toolbar2>
      <Divider />
      <List sx={{ flexGrow: 1, py: 1 }}>
        {NAV.map((item) => (
          <ListItem key={item.href} disablePadding sx={{ px: 1 }}>
            <ListItemButton
              component={NextLink}
              href={item.href}
              selected={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                  "& .MuiListItemIcon-root": { color: "#fff" },
                  "&:hover": { bgcolor: "primary.dark" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="primary"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
            {centerName}
          </Typography>
          <LogoutButton />
        </Toolbar>
      </AppBar>

      {/* Mobile temporary drawer */}
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

      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        <Box sx={{ p: { xs: 1.5, sm: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
