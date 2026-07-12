"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import CampaignIcon from "@mui/icons-material/Campaign";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { useToast } from "@/components/providers/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";
import type { ConversationRow, InboxPage, MessageableTenant } from "@/lib/messages/queries";
import { MESSAGE_MAX } from "@/lib/messages/constants";
import { loadInbox, sendToAdmin, broadcast } from "@/app/superadmin/messages/actions";
import ConversationList from "./ConversationList";

export default function MessagesInbox({
  initial,
  tenants,
}: {
  initial: InboxPage;
  tenants: MessageableTenant[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<ConversationRow[]>(initial.rows);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstRun = useRef(true);

  // New message dialog
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTenant, setComposeTenant] = useState<MessageableTenant | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  // Broadcast dialog
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  // Debounced search.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await loadInbox(search, 0);
        setRows(res.rows);
        setHasMore(res.hasMore);
      } catch {
        toast.error("Couldn't load the inbox.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, toast]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await loadInbox(search, rows.length);
      setRows((r) => [...r, ...res.rows]);
      setHasMore(res.hasMore);
    } catch {
      toast.error("Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitCompose() {
    if (!composeTenant || !composeBody.trim()) return;
    setSending(true);
    const res = await sendToAdmin(composeTenant.tenantId, composeBody);
    setSending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't send the message.");
      return;
    }
    const id = composeTenant.tenantId;
    setComposeOpen(false);
    setComposeBody("");
    setComposeTenant(null);
    toast.success("Message sent.");
    router.push(`/superadmin/messages/${id}`);
  }

  async function submitBroadcast() {
    if (!broadcastBody.trim()) return;
    setBroadcasting(true);
    const res = await broadcast(broadcastBody);
    setBroadcasting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't broadcast.");
      return;
    }
    setBroadcastOpen(false);
    setBroadcastBody("");
    toast.success(`Broadcast delivered to ${res.delivered} admin${res.delivered === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search centers…"
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="clear search" onClick={() => setSearch("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : null,
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => setBroadcastOpen(true)}>
              Broadcast
            </Button>
            <Button startIcon={<RateReviewOutlinedIcon />} onClick={() => setComposeOpen(true)}>
              New message
            </Button>
          </Stack>
        </Stack>

        <Card sx={{ overflow: "hidden" }}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<ForumOutlinedIcon />}
              title={search ? "No centers match your search" : "No conversations yet"}
              description={
                search
                  ? "Try a different name."
                  : "Start a conversation with a coaching center using “New message”."
              }
            />
          ) : (
            <ConversationList rows={rows} />
          )}
        </Card>

        {hasMore && (
          <Box sx={{ display: "grid", placeItems: "center" }}>
            <Button variant="text" onClick={loadMore} disabled={loadingMore} startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}>
              Load more
            </Button>
          </Box>
        )}
      </Stack>

      {/* New message */}
      <Dialog open={composeOpen} onClose={() => (sending ? undefined : setComposeOpen(false))} maxWidth="sm" fullWidth>
        <DialogTitle>New message</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Autocomplete
              options={tenants}
              value={composeTenant}
              onChange={(_e, v) => setComposeTenant(v)}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.tenantId === b.tenantId}
              renderInput={(params) => <TextField {...params} label="Coaching center" placeholder="Choose a center" />}
            />
            <TextField
              label="Message"
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              multiline
              minRows={3}
              inputProps={{ maxLength: MESSAGE_MAX }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="text" color="inherit" onClick={() => setComposeOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submitCompose} disabled={sending || !composeTenant || !composeBody.trim()} startIcon={sending ? <CircularProgress size={16} /> : undefined}>
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Broadcast */}
      <Dialog open={broadcastOpen} onClose={() => (broadcasting ? undefined : setBroadcastOpen(false))} maxWidth="sm" fullWidth>
        <DialogTitle>Broadcast to all admins</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This message is delivered to every coaching-center admin&apos;s inbox.
          </Typography>
          <TextField
            label="Message"
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            inputProps={{ maxLength: MESSAGE_MAX }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="text" color="inherit" onClick={() => setBroadcastOpen(false)} disabled={broadcasting}>
            Cancel
          </Button>
          <Button color="secondary" onClick={submitBroadcast} disabled={broadcasting || !broadcastBody.trim()} startIcon={broadcasting ? <CircularProgress size={16} /> : <CampaignIcon />}>
            Broadcast
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
