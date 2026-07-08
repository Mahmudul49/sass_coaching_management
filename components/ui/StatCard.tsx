import type { ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Large, glanceable stat card. `tint` is a base color used for the icon chip and
 * a soft background wash so each metric reads at a glance on a phone.
 */
export default function StatCard({
  label,
  value,
  icon,
  color = "#0F7A6B",
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}14, ${color}03)`,
          pointerEvents: "none",
        }}
      />
      <CardContent sx={{ position: "relative", p: { xs: 1.5, sm: 2.5 } }}>
        {icon && (
          <Box
            sx={{
              width: { xs: 38, sm: 44 },
              height: { xs: 38, sm: 44 },
              borderRadius: 2.5,
              bgcolor: color,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              mb: { xs: 1, sm: 1.5 },
              boxShadow: `0 6px 16px -6px ${color}80`,
              "& svg": { fontSize: { xs: 20, sm: 24 } },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          fontWeight={800}
          noWrap
          sx={{ lineHeight: 1.1, fontSize: { xs: "1.25rem", sm: "2rem" } }}
        >
          {value}
        </Typography>
        <Typography
          color="text.secondary"
          noWrap
          sx={{ mt: 0.5, fontSize: { xs: "0.72rem", sm: "0.875rem" } }}
        >
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
