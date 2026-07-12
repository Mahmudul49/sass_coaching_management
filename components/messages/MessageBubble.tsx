"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BlockIcon from "@mui/icons-material/Block";
import { alpha } from "@mui/material/styles";
import type { MessageRow } from "@/lib/messages/queries";
import { clockTime } from "./format";

/**
 * A single chat bubble. Mine (viewer's own) align right in the brand colour;
 * the other party's align left on a surface card. Soft-deleted messages show a
 * neutral "deleted" placeholder. Read receipts (✓ / ✓✓) show on my messages.
 */
export default function MessageBubble({
  row,
  deletedLabel,
  canDelete = false,
  onDelete,
}: {
  row: MessageRow;
  deletedLabel: string;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
}) {
  const mine = row.mine;
  const delBtn =
    canDelete && !row.deleted && onDelete ? (
      <Tooltip title="Delete for everyone">
        <IconButton
          className="msg-del"
          size="small"
          aria-label="delete message"
          onClick={() => onDelete(row.id)}
          sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity .15s", color: "text.disabled" }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : null;

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        px: { xs: 1.5, sm: 2 },
        "&:hover .msg-del": { opacity: 1 },
        animation: "msgIn .2s ease both",
        "@keyframes msgIn": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: { xs: "86%", sm: "72%" } }}>
        {mine && delBtn}

        <Box
          sx={{
            position: "relative",
            px: 1.5,
            py: 1,
            borderRadius: 2.5,
            ...(mine
              ? {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  borderBottomRightRadius: 6,
                }
              : {
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderBottomLeftRadius: 6,
                }),
            ...(row.deleted && {
              bgcolor: (t) => alpha(t.palette.text.primary, 0.05),
              color: "text.disabled",
              border: "1px dashed",
              borderColor: "divider",
            }),
          }}
        >
          {row.deleted ? (
            <Typography
              variant="body2"
              sx={{ display: "flex", alignItems: "center", gap: 0.75, fontStyle: "italic" }}
            >
              <BlockIcon sx={{ fontSize: 15 }} /> {deletedLabel}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
              {row.body}
            </Typography>
          )}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.4,
              mt: 0.25,
              opacity: mine && !row.deleted ? 0.85 : 0.6,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: "0.66rem", color: "inherit" }}>
              {clockTime(row.createdAt)}
            </Typography>
            {mine && !row.deleted && (
              row.read ? (
                <DoneAllIcon sx={{ fontSize: 14 }} />
              ) : (
                <CheckIcon sx={{ fontSize: 14 }} />
              )
            )}
          </Box>
        </Box>
        {!mine && delBtn}
      </Box>
    </Box>
  );
}
