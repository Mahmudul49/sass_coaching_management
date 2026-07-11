"use client";
import type { ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha, useTheme, type Theme } from "@mui/material/styles";

/**
 * Glanceable KPI tile. `color` accepts EITHER a concrete color (`#0F7A6B`,
 * `rgb(...)`) OR an MUI palette path (`success.main`, `secondary.main`) — we
 * resolve it to a real color so `alpha()` always gets a valid input. `hint` is
 * an optional sub-line. Prop contract is backward compatible.
 */
function resolveColor(theme: Theme, c: string): string {
  if (c.startsWith("#") || c.startsWith("rgb") || c.startsWith("hsl") || c.startsWith("color(")) {
    return c;
  }
  // Palette path like "success.main" / "secondary.dark".
  let node: unknown = theme.palette;
  for (const part of c.split(".")) {
    node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === "string" ? node : theme.palette.primary.main;
}

export default function StatCard({
  label,
  value,
  icon,
  color = "#0F7A6B",
  hint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: string;
  hint?: ReactNode;
}) {
  const theme = useTheme();
  const c = resolveColor(theme, color);

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(c, 0.35),
          boxShadow: `0 10px 30px -12px ${alpha(c, 0.4)}`,
        },
      }}
    >
      {/* Top accent hairline in the metric colour */}
      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, bgcolor: c, opacity: 0.9 }} />
      {/* Soft corner wash for depth */}
      <Box
        sx={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(c, 0.14)}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <CardContent sx={{ position: "relative", p: { xs: 1.75, sm: 2.5 } }}>
        {icon && (
          <Box
            sx={{
              width: { xs: 38, sm: 44 },
              height: { xs: 38, sm: 44 },
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              mb: { xs: 1.25, sm: 1.75 },
              color: c,
              bgcolor: alpha(c, 0.12),
              border: `1px solid ${alpha(c, 0.22)}`,
              "& svg": { fontSize: { xs: 20, sm: 24 } },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          noWrap
          sx={{
            fontFamily: "var(--font-display), var(--font-bengali), sans-serif",
            fontWeight: 780,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
            fontSize: { xs: "1.4rem", sm: "2rem" },
          }}
        >
          {value}
        </Typography>
        <Typography
          noWrap
          sx={{
            mt: 0.75,
            color: "text.secondary",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontSize: { xs: "0.64rem", sm: "0.72rem" },
          }}
        >
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "text.disabled" }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
