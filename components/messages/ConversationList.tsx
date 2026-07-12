"use client";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Badge from "@mui/material/Badge";
import ButtonBase from "@mui/material/ButtonBase";
import { alpha } from "@mui/material/styles";
import type { ConversationRow } from "@/lib/messages/queries";
import { relativeShort } from "./format";

/** Super-Admin inbox list. Each row links to that tenant's conversation. */
export default function ConversationList({ rows }: { rows: ConversationRow[] }) {
  return (
    <Stack>
      {rows.map((r, i) => {
        const unread = r.unread > 0;
        const preview =
          (r.lastSenderRole === "superadmin" ? "You: " : "") + (r.lastMessagePreview || "No messages yet");
        return (
          <ButtonBase
            key={r.tenantId}
            component={NextLink}
            href={`/superadmin/messages/${r.tenantId}`}
            sx={{
              display: "block",
              textAlign: "left",
              px: 2,
              py: 1.5,
              borderTop: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
              transition: "background-color .14s ease",
              "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
              <Badge
                color="primary"
                overlap="circular"
                badgeContent={unread ? r.unread : 0}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              >
                <Avatar sx={{ bgcolor: unread ? "primary.main" : "action.selected", color: unread ? "#fff" : "text.secondary", fontWeight: 700 }}>
                  {r.tenantName.trim()[0]?.toUpperCase() ?? "?"}
                </Avatar>
              </Badge>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography fontWeight={unread ? 800 : 650} noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {r.tenantName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: unread ? "primary.main" : "text.disabled", fontWeight: unread ? 700 : 500, flexShrink: 0 }}>
                    {relativeShort(r.lastMessageAt)}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ color: unread ? "text.primary" : "text.secondary", fontWeight: unread ? 600 : 400 }}
                >
                  {preview}
                </Typography>
              </Box>
            </Stack>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
