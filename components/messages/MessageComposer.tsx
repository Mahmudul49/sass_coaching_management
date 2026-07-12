"use client";
import { useState, useTransition, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import SendIcon from "@mui/icons-material/Send";
import { MESSAGE_MAX } from "@/lib/messages/constants";

/**
 * Reusable chat composer. Enter sends, Shift+Enter inserts a newline. The parent
 * supplies `onSend` (returns whether the send succeeded, so we only clear on
 * success). Grows up to a few lines then scrolls.
 */
export default function MessageComposer({
  onSend,
  placeholder,
  sendLabel = "Send",
  disabled = false,
}: {
  onSend: (body: string) => Promise<boolean>;
  placeholder: string;
  sendLabel?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const canSend = value.trim().length > 0 && value.length <= MESSAGE_MAX && !pending && !disabled;
  const nearLimit = value.length > MESSAGE_MAX - 200;

  function submit() {
    if (!canSend) return;
    const body = value;
    start(async () => {
      const ok = await onSend(body);
      if (ok) setValue("");
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        p: 1,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          bgcolor: "background.default",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          px: 1.5,
          py: 0.75,
          transition: "border-color .15s, box-shadow .15s",
          "&:focus-within": {
            borderColor: "primary.main",
            boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}22`,
          },
        }}
      >
        <InputBase
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          multiline
          maxRows={6}
          sx={{ flex: 1, fontSize: "0.95rem" }}
          inputProps={{ "aria-label": placeholder, maxLength: MESSAGE_MAX }}
        />
        {nearLimit && (
          <Box
            component="span"
            sx={{ fontSize: "0.68rem", color: value.length > MESSAGE_MAX ? "error.main" : "text.disabled", pb: 0.5, pl: 0.5 }}
          >
            {MESSAGE_MAX - value.length}
          </Box>
        )}
      </Box>
      <IconButton
        color="primary"
        aria-label={sendLabel}
        onClick={submit}
        disabled={!canSend}
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          width: 44,
          height: 44,
          transition: "background-color .15s, transform .12s",
          "&:hover": { bgcolor: "primary.dark" },
          "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "action.disabled" },
          "&:active": { transform: "scale(0.94)" },
        }}
      >
        {pending ? <CircularProgress size={20} color="inherit" /> : <SendIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
