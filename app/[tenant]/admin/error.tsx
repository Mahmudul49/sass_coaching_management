"use client";
import { useEffect } from "react";
import Box from "@mui/material/Box";
import ErrorState from "@/components/ui/ErrorState";

/**
 * Admin-area error boundary. Catches render/data errors in any admin page and
 * offers a recovery ("try again") without a full reload. Pure UI — no logic.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <Box sx={{ minHeight: "60dvh", display: "grid", placeItems: "center" }}>
      <ErrorState
        title="Something went wrong"
        description="We couldn't load this page. Please try again."
        retryLabel="Try again"
        onRetry={reset}
      />
    </Box>
  );
}
