"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReportGmailerrorredIcon from "@mui/icons-material/ReportGmailerrorred";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

/**
 * Reusable error surface — a calm, recoverable message with an optional retry.
 * Pairs with EmptyState / Loading so every async surface has all three states.
 */
export default function ErrorState({
  title = "Something went wrong",
  description,
  retryLabel = "Try again",
  onRetry,
  icon,
}: {
  title?: string;
  description?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: { xs: 5, sm: 7 },
        px: 2,
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
          color: "error.main",
          bgcolor: (t) => alpha(t.palette.error.main, 0.08),
          boxShadow: (t) => `0 0 0 8px ${alpha(t.palette.error.main, 0.05)}`,
          "& svg": { fontSize: 36 },
        }}
      >
        {icon ?? <ReportGmailerrorredIcon fontSize="inherit" />}
      </Box>
      <Typography variant="h6" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, lineHeight: 1.6 }}>
          {description}
        </Typography>
      )}
      {onRetry && (
        <Button onClick={onRetry} size="large" startIcon={<RefreshIcon />} sx={{ mt: 1.5 }}>
          {retryLabel}
        </Button>
      )}
    </Box>
  );
}
