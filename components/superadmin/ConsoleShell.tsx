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
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Badge from "@mui/material/Badge";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import StorefrontIcon from "@mui/icons-material/Storefront";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PaletteIcon from "@mui/icons-material/Palette";
import ForumIcon from "@mui/icons-material/Forum";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import type { Role } from "@/lib/db/collections";
import { can, type Permission } from "@/lib/auth/permissions";
import LogoutButton from "@/components/layout/LogoutButton";
import { useConsoleMode } from "@/components/providers/ConsoleThemeProvider";

const DRAWER_WIDTH = 264;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  perm: Permission;
  exact?: boolean;
  badge?: number;
};

export default function ConsoleShell({
  role,
  children,
  unreadMessages = 0,
}: {
  role: Role;
  children: React.ReactNode;
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, toggle } = useConsoleMode();

  const nav = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/superadmin", label: "Dashboard", icon: <DashboardIcon />, perm: "console:view", exact: true },
      { href: "/superadmin/messages", label: "Messages", icon: <ForumIcon />, perm: "messages:manage", badge: unreadMessages },
      { href: "/superadmin/students", label: "Students", icon: <GroupsIcon />, perm: "students:read" },
      { href: "/superadmin/users", label: "Users & Roles", icon: <ManageAccountsIcon />, perm: "users:manage" },
      { href: "/superadmin/theme", label: "Theme Builder", icon: <PaletteIcon />, perm: "theme:manage" },
    ];
    return items.filter((i) => can(role, i.perm));
  }, [role, unreadMessages]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "var(--sidebar-bg)",
        color: "var(--sidebar-fg)",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <AdminPanelSettingsIcon />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
            Coaching Manager
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Admin Console
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(127,127,127,0.28)" }} />
      <List sx={{ flexGrow: 1, py: 1.5, px: 1.25 }}>
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={NextLink}
                href={item.href}
                selected={active}
                onClick={() => setMobileOpen(false)}
                sx={{
                  mb: 0.5,
                  minHeight: 48,
                  color: "inherit",
                  opacity: active ? 1 : 0.82,
                  "& .MuiListItemIcon-root": { color: "inherit", minWidth: 40 },
                  "&:hover": { bgcolor: "rgba(127,127,127,0.16)", opacity: 1 },
                  "&.Mui-selected": {
                    bgcolor: "rgba(127,127,127,0.28)",
                    "&:hover": { bgcolor: "rgba(127,127,127,0.34)" },
                  },
                }}
              >
                <ListItemIcon>
                  {item.badge ? (
                    <Badge color="error" badgeContent={item.badge} max={99}>
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 2 }}>
        <Chip
          size="small"
          label={role === "superadmin" ? "SuperAdmin" : "Admin"}
          sx={{ bgcolor: "rgba(127,127,127,0.22)", color: "inherit", fontWeight: 700 }}
        />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: "var(--navbar-bg)",
          color: "var(--navbar-fg)",
          borderBottom: "1px solid rgba(127,127,127,0.22)",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="menu"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }} noWrap>
            Admin Console
          </Typography>
          {can(role, "messages:manage") && (
            <Tooltip title="Messages">
              <IconButton color="inherit" component={NextLink} href="/superadmin/messages" aria-label="Messages">
                <Badge color="error" badgeContent={unreadMessages} max={99}>
                  <ForumIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <IconButton color="inherit" onClick={toggle} aria-label="toggle color mode">
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
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
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", border: 0 },
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
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", border: 0 },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minWidth: 0 }}>
        <Toolbar />
        <Box sx={{ p: { xs: 2, sm: 2.5, md: 3.5 }, maxWidth: 1240, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
