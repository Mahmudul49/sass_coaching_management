"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { useToast } from "@/components/providers/ToastProvider";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { MessageRow, ThreadPage } from "@/lib/messages/queries";
import { sendToAdmin, markSuperRead, loadSuperThread, deleteMessage } from "@/app/superadmin/messages/actions";
import ChatThread from "./ChatThread";
import MessageComposer from "./MessageComposer";

/** Super-Admin conversation with one tenant admin. Can reply + soft delete. */
export default function SuperChat({
  tenantId,
  tenantName,
  tenantActive,
  initial,
}: {
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  initial: ThreadPage;
}) {
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<MessageRow[]>(initial.rows);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [oldestId, setOldestId] = useState<string | null>(initial.oldestId);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const markedRef = useRef(false);

  useEffect(() => {
    setRows(initial.rows);
    setHasMore(initial.hasMore);
    setOldestId(initial.oldestId);
  }, [initial]);

  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markSuperRead(tenantId).then(() => router.refresh());
  }, [router, tenantId]);

  async function handleSend(body: string): Promise<boolean> {
    const optimistic: MessageRow = {
      id: `tmp-${Date.now()}`,
      senderRole: "superadmin",
      senderName: "",
      body,
      createdAt: new Date().toISOString(),
      deleted: false,
      mine: true,
      read: false,
    };
    setRows((r) => [...r, optimistic]);
    const res = await sendToAdmin(tenantId, body);
    if (!res.ok) {
      setRows((r) => r.filter((m) => m.id !== optimistic.id));
      toast.error(res.error ?? "Couldn't send the message.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleLoadOlder() {
    if (!oldestId) return;
    setLoadingOlder(true);
    try {
      const older = await loadSuperThread(tenantId, oldestId);
      setRows((r) => [...older.rows, ...r]);
      setHasMore(older.hasMore);
      setOldestId(older.oldestId);
    } catch {
      toast.error("Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const id = toDelete;
    const res = await deleteMessage(id, tenantId);
    setDeleting(false);
    setToDelete(null);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't delete the message.");
      return;
    }
    setRows((r) => r.map((m) => (m.id === id ? { ...m, deleted: true, body: "" } : m)));
    router.refresh();
  }

  return (
    <>
      <Card
        sx={{
          display: "flex",
          flexDirection: "column",
          height: { xs: "calc(100dvh - 150px)", md: "calc(100dvh - 176px)" },
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ p: 1.25, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
        >
          <IconButton component={NextLink} href="/superadmin/messages" aria-label="back to inbox" size="small">
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
            <StorefrontIcon fontSize="small" />
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={700} noWrap>
              {tenantName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Coaching center admin
            </Typography>
          </Box>
          {!tenantActive && <Chip size="small" color="default" variant="outlined" label="Inactive" />}
        </Stack>

        <ChatThread
          rows={rows}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
          canDelete
          onDelete={(id) => setToDelete(id)}
          deletedLabel="This message was deleted"
          loadOlderLabel="Load older messages"
          empty={
            <EmptyState
              icon={<ForumOutlinedIcon />}
              title="No messages yet"
              description={`Start the conversation with ${tenantName}.`}
            />
          }
        />

        <MessageComposer onSend={handleSend} placeholder={`Message ${tenantName}…`} />
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete message?"
        message="This message will be removed for everyone. This can't be undone from the UI."
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
      />
    </>
  );
}
