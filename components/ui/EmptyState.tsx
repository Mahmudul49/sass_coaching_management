"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InboxIcon from "@mui/icons-material/Inbox";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

/**
 * Empty state that names the next step. The icon sits in a soft concentric ring
 * so the block reads as intentional, not just "no data". Prop contract unchanged.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: { xs: 5, sm: 7 },
        px: 2,
        color: "text.secondary",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 76,
          height: 76,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          mb: 0.5,
          color: "primary.main",
          bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          boxShadow: (t) => `0 0 0 8px ${alpha(t.palette.primary.main, 0.05)}`,
          "& svg": { fontSize: 34 },
        }}
      >
        {icon ?? <InboxIcon fontSize="inherit" />}
      </Box>
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 380, lineHeight: 1.6 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="large" sx={{ mt: 1.5 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
