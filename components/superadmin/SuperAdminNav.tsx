"use client";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { useI18n } from "@/components/providers/I18nProvider";

export default function SuperAdminNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const value = pathname.startsWith("/superadmin/students") ? 1 : 0;

  const links = [
    { href: "/superadmin", label: t("sa_nav_dashboard") },
    { href: "/superadmin/students", label: t("sa_nav_marketing") },
  ];

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs value={value}>
        {links.map((link, i) => (
          <Tab
            key={link.href}
            label={link.label}
            component={NextLink}
            href={link.href}
            value={i}
          />
        ))}
      </Tabs>
    </Box>
  );
}
