import type { ReactNode } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import PaidIcon from "@mui/icons-material/Paid";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";

/** Big, thumb-friendly shortcut tiles to the most-used actions. */
export default function QuickActions({ base }: { base: string }) {
  const actions: { href: string; label: string; icon: ReactNode; color: string }[] = [
    { href: `${base}/payments`, label: "পেমেন্ট", icon: <PaidIcon />, color: "#16A34A" },
    { href: `${base}/attendance`, label: "উপস্থিতি", icon: <FactCheckIcon />, color: "#0284C7" },
    { href: `${base}/reports`, label: "রিপোর্ট", icon: <AssessmentIcon />, color: "#7C3AED" },
    { href: `${base}/students`, label: "শিক্ষার্থী", icon: <PersonAddAlt1Icon />, color: "#E4890B" },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
      }}
    >
      {actions.map((a) => (
        <Card key={a.href}>
          <CardActionArea
            component={NextLink}
            href={a.href}
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              minHeight: 104,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: `${a.color}18`,
                color: a.color,
                display: "grid",
                placeItems: "center",
                "& svg": { fontSize: 26 },
              }}
            >
              {a.icon}
            </Box>
            <Typography fontWeight={700}>{a.label}</Typography>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
}
