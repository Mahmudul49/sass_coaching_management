"use client";
import { Fragment, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import type { ReactNode } from "react";
import type { MessageRow } from "@/lib/messages/queries";
import MessageBubble from "./MessageBubble";
import { daySeparator, sameDay } from "./format";

/**
 * Scrollable message thread. Presentational: the parent owns the rows and the
 * "load older" cursor. Auto-scrolls to the newest message on first paint and
 * whenever a new message is appended; keeps a "load older" affordance at the top.
 */
export default function ChatThread({
  rows,
  hasMore,
  loadingOlder,
  onLoadOlder,
  canDelete = false,
  onDelete,
  deletedLabel,
  loadOlderLabel,
  empty,
}: {
  rows: MessageRow[];
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  deletedLabel: string;
  loadOlderLabel: string;
  empty: ReactNode;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = rows.length ? rows[rows.length - 1].id : null;

  // Scroll to the newest message on mount + whenever a new one arrives.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  if (rows.length === 0) {
    return (
      <Box sx={{ flex: 1, display: "grid", placeItems: "center", overflow: "auto" }}>{empty}</Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        py: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        // Subtle chat "canvas" texture, theme-aware.
        backgroundImage: (t) =>
          `radial-gradient(circle at 1px 1px, ${t.palette.divider} 1px, transparent 0)`,
        backgroundSize: "22px 22px",
      }}
    >
      {hasMore && (
        <Box sx={{ display: "grid", placeItems: "center", pb: 0.5 }}>
          <Button
            size="small"
            variant="text"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            startIcon={loadingOlder ? <CircularProgress size={14} /> : undefined}
          >
            {loadOlderLabel}
          </Button>
        </Box>
      )}

      {rows.map((row, i) => {
        const prev = rows[i - 1];
        const showDay = !prev || !sameDay(prev.createdAt, row.createdAt);
        return (
          <Fragment key={row.id}>
            {showDay && (
              <Box sx={{ display: "grid", placeItems: "center", my: 1 }}>
                <Chip
                  label={daySeparator(row.createdAt)}
                  size="small"
                  sx={{
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    fontWeight: 600,
                    color: "text.secondary",
                  }}
                />
              </Box>
            )}
            <MessageBubble row={row} deletedLabel={deletedLabel} canDelete={canDelete} onDelete={onDelete} />
          </Fragment>
        );
      })}
      <Box ref={bottomRef} />
    </Box>
  );
}
