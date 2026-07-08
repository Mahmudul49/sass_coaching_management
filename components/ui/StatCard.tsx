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
      <CardContent sx={{ position: "relative", p: { xs: 2, sm: 2.5 } }}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor: color,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              mb: 1.5,
              boxShadow: `0 6px 16px -6px ${color}80`,
            }}
          >
            {icon}
          </Box>
        )}
        <Typography variant="h4" fontWeight={800} noWrap sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
