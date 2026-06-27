"use client";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";

const LINKS = [
  { href: "/superadmin", label: "ড্যাশবোর্ড" },
  { href: "/superadmin/students", label: "মার্কেটিং — ছাত্র" },
];

export default function SuperAdminNav() {
  const pathname = usePathname();
  const value = pathname.startsWith("/superadmin/students") ? 1 : 0;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs value={value}>
        {LINKS.map((link, i) => (
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
