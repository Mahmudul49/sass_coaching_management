"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Collapse from "@mui/material/Collapse";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ClassIcon from "@mui/icons-material/Class";
import CategoryIcon from "@mui/icons-material/Category";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GroupsIcon from "@mui/icons-material/Groups";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import GradingIcon from "@mui/icons-material/Grading";
import PaidIcon from "@mui/icons-material/Paid";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SummarizeIcon from "@mui/icons-material/Summarize";
import SettingsIcon from "@mui/icons-material/Settings";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SchoolIcon from "@mui/icons-material/School";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import LogoutButton from "./LogoutButton";
import { alpha } from "@mui/material/styles";
import { tenantAdminBaseFromPath } from "./tenantAdminBase";
import { useI18n } from "@/components/providers/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const DRAWER_WIDTH = 268;
const RAIL_WIDTH = 76;
const LS_COLLAPSED = "admin.nav.collapsed";
const LS_GROUPS = "admin.nav.groups";

/* ── Navigation model ──────────────────────────────────────────────────────────
   Regroups the existing 10 admin destinations into scannable clusters. No routes,
   guards or business logic change — only presentation and ordering. */
type LeafDef = {
  key: MessageKey;
  slug: string;
  icon: ReactNode;
  badgeKey?: "messages";
  // Optional `?tab=` query for destinations that share a path (e.g. the Reports
  // page's payment/attendance tabs). Two leaves may point at the same `slug`
  // and are disambiguated by this value for both the link and the active state.
  tab?: string;
};
type NodeDef =
  | ({ kind: "leaf" } & LeafDef)
  | { kind: "group"; id: string; key: MessageKey; icon: ReactNode; children: LeafDef[] };

const MODEL: NodeDef[] = [
  { kind: "leaf", key: "nav_dashboard", slug: "", icon: <DashboardIcon /> },
  { kind: "leaf", key: "nav_students", slug: "/students", icon: <GroupsIcon /> },
  {
    kind: "group",
    id: "academic",
    key: "nav_group_academic",
    icon: <MenuBookIcon />,
    children: [
      { key: "nav_attendance", slug: "/attendance", icon: <FactCheckIcon /> },
      // Attendance report lives on the shared Reports page (Finance) under the
      // `attendance` tab; surfaced here beside Attendance for discoverability.
      { key: "nav_attendance_report", slug: "/reports", tab: "attendance", icon: <SummarizeIcon /> },
      { key: "nav_results", slug: "/results", icon: <GradingIcon /> },
      { key: "nav_classes", slug: "/classes", icon: <ClassIcon /> },
      { key: "nav_sections", slug: "/sections", icon: <CategoryIcon /> },
    ],
  },
  {
    kind: "group",
    id: "finance",
    key: "nav_group_finance",
    icon: <AccountBalanceWalletIcon />,
    children: [
      { key: "nav_payments", slug: "/payments", icon: <PaidIcon /> },
      { key: "nav_reports", slug: "/reports", icon: <AssessmentIcon /> },
      { key: "nav_fees", slug: "/fees", icon: <ReceiptLongIcon /> },
    ],
  },
  { kind: "leaf", key: "nav_messages", slug: "/messages", icon: <ForumOutlinedIcon />, badgeKey: "messages" },
  { kind: "leaf", key: "nav_settings", slug: "/settings", icon: <SettingsIcon /> },
];

// Flat list of every leaf, in display order — used for the collapsed rail,
// bottom-nav lookups and page-title resolution.
const ALL_LEAVES: LeafDef[] = MODEL.flatMap((n) =>
  n.kind === "leaf" ? [n] : n.children
);

// Slugs surfaced in the mobile bottom bar (the rest live under "More").
const BOTTOM_SLUGS = ["", "/students", "/payments", "/messages"] as const;

/** Reads a persisted value once on mount (client only), then keeps it in sync. */
function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* private mode / disabled storage — fall back to defaults */
    }
  }, [key]);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export default function AdminShell({
  centerName,
  children,
  unreadMessages = 0,
}: {
  centerName: string;
  children: ReactNode;
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const base = tenantAdminBaseFromPath(pathname);
  const { t } = useI18n();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersisted<boolean>(LS_COLLAPSED, false);
  const [openGroups, setOpenGroups] = usePersisted<Record<string, boolean>>(LS_GROUPS, {
    academic: true,
    finance: true,
  });

  const hrefOf = useCallback((slug: string) => `${base}${slug}`, [base]);
  // Full link target for a leaf, including its `?tab=` when present.
  const leafHref = useCallback(
    (leaf: LeafDef) => `${hrefOf(leaf.slug)}${leaf.tab ? `?tab=${leaf.tab}` : ""}`,
    [hrefOf]
  );
  const badgeOf = useCallback(
    (leaf: LeafDef) => (leaf.badgeKey === "messages" ? unreadMessages : 0),
    [unreadMessages]
  );
  const isActive = useCallback(
    (leaf: LeafDef) => {
      if (leaf.slug === "") return pathname === base;
      if (!pathname.startsWith(hrefOf(leaf.slug))) return false;
      // A leaf with a `tab` is active only on that tab. An untabbed leaf that
      // shares its path with a tabbed sibling is the "default tab" and yields
      // while that sibling's tab is selected — so exactly one of the pair is
      // active (e.g. Finance "Reports" vs Academic "Attendance Report").
      if (leaf.tab !== undefined) return currentTab === leaf.tab;
      const tabbedSibling = ALL_LEAVES.find((l) => l.slug === leaf.slug && l.tab !== undefined);
      return tabbedSibling ? currentTab !== tabbedSibling.tab : true;
    },
    [pathname, base, hrefOf, currentTab]
  );
  const groupHasActive = useCallback(
    (children: LeafDef[]) => children.some((c) => isActive(c)),
    [isActive]
  );

  // Auto-reveal the group that owns the current route — once, on first paint.
  useEffect(() => {
    const active = MODEL.find(
      (n) => n.kind === "group" && n.children.some((c) => isActive(c))
    );
    if (active && active.kind === "group") {
      setOpenGroups((prev) => (prev[active.id] ? prev : { ...prev, [active.id]: true }));
    }
    // Intentionally runs on mount only; user toggles are respected thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLeaf = useMemo(
    () => ALL_LEAVES.find((l) => isActive(l)),
    [isActive]
  );
  const pageTitle = activeLeaf ? t(activeLeaf.key) : centerName;

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleGroup = useCallback(
    (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] })),
    [setOpenGroups]
  );

  /* ── Leaf row ─────────────────────────────────────────────────────────────── */
  const leafButton = (leaf: LeafDef, opts: { rail: boolean; nested?: boolean }) => {
    const active = isActive(leaf);
    const badge = badgeOf(leaf);
    const label = t(leaf.key);
    const icon = badge ? (
      <Badge color="error" badgeContent={badge} max={99}>
        {leaf.icon}
      </Badge>
    ) : (
      leaf.icon
    );

    const button = (
      <ListItemButton
        component={NextLink}
        href={leafHref(leaf)}
        selected={active}
        onClick={closeMobile}
        aria-current={active ? "page" : undefined}
        sx={{
          minHeight: 46,
          position: "relative",
          justifyContent: opts.rail ? "center" : "flex-start",
          px: opts.rail ? 0 : opts.nested ? 1.75 : 1.25,
          color: "text.secondary",
          "& .MuiListItemIcon-root": { color: "text.secondary", transition: "color .16s ease" },
          "&:hover": { bgcolor: "action.hover" },
          "&.Mui-selected": {
            bgcolor: (th) => alpha(th.palette.primary.main, 0.1),
            color: "primary.dark",
            "& .MuiListItemIcon-root": { color: "primary.main" },
            "&:hover": { bgcolor: (th) => alpha(th.palette.primary.main, 0.16) },
            "&::before": {
              content: '""',
              position: "absolute",
              left: opts.rail ? 6 : 4,
              top: "50%",
              transform: "translateY(-50%)",
              width: 3,
              height: 20,
              borderRadius: 3,
              bgcolor: "primary.main",
            },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: opts.rail ? 0 : 38, justifyContent: "center" }}>
          {icon}
        </ListItemIcon>
        {!opts.rail && (
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontWeight: active ? 700 : 600,
              fontSize: "0.92rem",
              noWrap: true,
            }}
          />
        )}
      </ListItemButton>
    );

    return (
      <ListItem key={leaf.key} disablePadding sx={{ mb: 0.25 }}>
        {opts.rail ? (
          <Tooltip title={label} placement="right" arrow>
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </ListItem>
    );
  };

  /* ── Group header + collapsible children ──────────────────────────────────── */
  const groupBlock = (node: Extract<NodeDef, { kind: "group" }>) => {
    const open = !!openGroups[node.id];
    const hasActive = groupHasActive(node.children);
    const label = t(node.key);
    return (
      <Box key={node.id} sx={{ mb: 0.25 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => toggleGroup(node.id)}
            aria-expanded={open}
            aria-controls={`nav-group-${node.id}`}
            sx={{
              minHeight: 46,
              px: 1.25,
              color: hasActive ? "primary.dark" : "text.secondary",
              "& .MuiListItemIcon-root": {
                color: hasActive ? "primary.main" : "text.secondary",
                transition: "color .16s ease",
              },
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, justifyContent: "center" }}>{node.icon}</ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontWeight: hasActive ? 700 : 600, fontSize: "0.92rem", noWrap: true }}
            />
            {/* Dot when collapsed-and-active so the current section is still findable */}
            {!open && hasActive && (
              <Box
                sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", mr: 0.75 }}
              />
            )}
            <ExpandMoreIcon
              fontSize="small"
              sx={{
                color: "text.disabled",
                transition: "transform .2s ease",
                transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
          </ListItemButton>
        </ListItem>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List id={`nav-group-${node.id}`} disablePadding sx={{ pl: 1.25, ml: 0.5, borderLeft: (th) => `1px solid ${th.palette.divider}` }}>
            {node.children.map((c) => leafButton(c, { rail: false, nested: true }))}
          </List>
        </Collapse>
      </Box>
    );
  };

  /* ── Sidebar contents (expanded = grouped, rail = flat icons) ─────────────── */
  const sidebar = (rail: boolean) => (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar sx={{ gap: 1.25, justifyContent: rail ? "center" : "flex-start" }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            bgcolor: (th) => alpha(th.palette.primary.main, 0.12),
            border: (th) => `1px solid ${alpha(th.palette.primary.main, 0.22)}`,
            flexShrink: 0,
          }}
        >
          <SchoolIcon fontSize="small" />
        </Box>
        {!rail && (
          <Typography variant="subtitle1" fontWeight={750} noWrap sx={{ letterSpacing: "-0.01em" }}>
            {centerName}
          </Typography>
        )}
      </Toolbar>
      <Divider />
      <List
        component="nav"
        aria-label={t("nav_main_label")}
        sx={{ flexGrow: 1, py: 1.25, px: rail ? 1 : 1.25, overflowY: "auto" }}
      >
        {rail
          ? ALL_LEAVES.map((leaf) => leafButton(leaf, { rail: true }))
          : MODEL.map((node) =>
              node.kind === "leaf"
                ? leafButton(node, { rail: false })
                : groupBlock(node)
            )}
      </List>
      <Divider />
      {/* Collapse / expand rail — desktop only */}
      <Box sx={{ p: 1 }}>
        <Tooltip title={collapsed ? t("nav_expand_sidebar") : ""} placement="right" arrow>
          <ListItemButton
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t("nav_expand_sidebar") : t("nav_collapse_sidebar")}
            sx={{ minHeight: 44, justifyContent: rail ? "center" : "flex-start", px: rail ? 0 : 1.25, borderRadius: 2 }}
          >
            <ListItemIcon sx={{ minWidth: rail ? 0 : 38, justifyContent: "center", color: "text.secondary" }}>
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </ListItemIcon>
            {!rail && (
              <ListItemText
                primary={t("nav_collapse_sidebar")}
                primaryTypographyProps={{ fontWeight: 600, fontSize: "0.86rem", color: "text.secondary" }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const desktopWidth = collapsed ? RAIL_WIDTH : DRAWER_WIDTH;

  /* ── Bottom navigation (mobile) ───────────────────────────────────────────── */
  const bottomLeaves = BOTTOM_SLUGS.map((slug) => ALL_LEAVES.find((l) => l.slug === slug)!);
  const bottomValue = bottomLeaves.find((l) => isActive(l))?.slug ?? false;

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="primary" sx={{ zIndex: (th) => th.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label={t("menu")}
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <SchoolIcon sx={{ mr: 1.25, display: { xs: "none", md: "block" } }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }} noWrap>
            {pageTitle}
          </Typography>
          <Tooltip title={t("nav_messages")}>
            <IconButton
              color="inherit"
              component={NextLink}
              href={hrefOf("/messages")}
              aria-label={t("nav_messages")}
              sx={{ mr: 0.5 }}
            >
              <Badge color="error" badgeContent={unreadMessages} max={99}>
                <ForumOutlinedIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <LogoutButton />
        </Toolbar>
      </AppBar>

      {/* Mobile slide-out drawer: full grouped nav */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        {sidebar(false)}
      </Drawer>

      {/* Desktop persistent sidebar — collapsible to an icon rail */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: desktopWidth,
          flexShrink: 0,
          whiteSpace: "nowrap",
          "& .MuiDrawer-paper": {
            width: desktopWidth,
            boxSizing: "border-box",
            overflowX: "hidden",
            borderRight: (th) => `1px solid ${th.palette.divider}`,
            transition: (th) =>
              th.transitions.create("width", { duration: th.transitions.duration.shorter }),
          },
        }}
      >
        {sidebar(collapsed)}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${desktopWidth}px)` },
          minWidth: 0,
          transition: (th) =>
            th.transitions.create("width", { duration: th.transitions.duration.shorter }),
        }}
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

      {/* Mobile bottom navigation: 4 primary destinations + More */}
      <Paper
        elevation={3}
        sx={{
          display: { xs: "block", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (th) => th.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <BottomNavigation value={bottomValue} showLabels sx={{ height: 64 }}>
          {bottomLeaves.map((leaf) => {
            const badge = badgeOf(leaf);
            return (
              <BottomNavigationAction
                key={leaf.slug}
                component={NextLink}
                href={hrefOf(leaf.slug)}
                value={leaf.slug}
                label={t(leaf.key)}
                icon={
                  badge ? (
                    <Badge color="error" badgeContent={badge} max={99}>
                      {leaf.icon}
                    </Badge>
                  ) : (
                    leaf.icon
                  )
                }
                sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontSize: "0.7rem" } }}
              />
            );
          })}
          <BottomNavigationAction
            value="more"
            label={t("nav_more")}
            icon={<MoreHorizIcon />}
            onClick={() => setMobileOpen(true)}
            sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontSize: "0.7rem" } }}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
