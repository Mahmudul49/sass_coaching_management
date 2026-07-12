"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import EmptyState from "@/components/ui/EmptyState";
import type { MessageRow, ThreadPage } from "@/lib/messages/queries";
import { sendToSuper, markAdminRead, loadAdminThread } from "@/app/[tenant]/admin/actions/messages";
import ChatThread from "./ChatThread";
import MessageComposer from "./MessageComposer";

/** Admin-side conversation with the Super Admin (the only party an admin can message). */
export default function AdminChat({ initial }: { initial: ThreadPage }) {
  const router = useRouter();
  const toast = useToast();
  const { locale } = useI18n();
  const bn = locale === "bn";

  const [rows, setRows] = useState<MessageRow[]>(initial.rows);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [oldestId, setOldestId] = useState<string | null>(initial.oldestId);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const markedRef = useRef(false);

  // Keep in sync with server-driven refreshes (navigation / router.refresh()).
  useEffect(() => {
    setRows(initial.rows);
    setHasMore(initial.hasMore);
    setOldestId(initial.oldestId);
  }, [initial]);

  // Mark read once on open, then refresh so the nav unread badge clears.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markAdminRead().then(() => router.refresh());
  }, [router]);

  async function handleSend(body: string): Promise<boolean> {
    const optimistic: MessageRow = {
      id: `tmp-${Date.now()}`,
      senderRole: "admin",
      senderName: "",
      body,
      createdAt: new Date().toISOString(),
      deleted: false,
      mine: true,
      read: false,
    };
    setRows((r) => [...r, optimistic]);
    const res = await sendToSuper(body);
    if (!res.ok) {
      setRows((r) => r.filter((m) => m.id !== optimistic.id));
      toast.error(res.error ?? (bn ? "মেসেজ পাঠানো যায়নি।" : "Couldn't send the message."));
      return false;
    }
    router.refresh(); // reconcile with the stored message (real id + receipts)
    return true;
  }

  async function handleLoadOlder() {
    if (!oldestId) return;
    setLoadingOlder(true);
    try {
      const older = await loadAdminThread(oldestId);
      setRows((r) => [...older.rows, ...r]);
      setHasMore(older.hasMore);
      setOldestId(older.oldestId);
    } catch {
      toast.error(bn ? "লোড করা যায়নি।" : "Couldn't load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        height: { xs: "calc(100dvh - 168px)", md: "calc(100dvh - 148px)" },
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
      >
        <Avatar sx={{ bgcolor: "primary.main", width: 42, height: 42 }}>
          <SupportAgentIcon />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {bn ? "সুপার অ্যাডমিন" : "Super Admin"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {bn ? "প্ল্যাটফর্ম সহায়তা" : "Platform support"}
          </Typography>
        </Box>
      </Stack>

      <ChatThread
        rows={rows}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={handleLoadOlder}
        deletedLabel={bn ? "মেসেজটি মুছে ফেলা হয়েছে" : "This message was deleted"}
        loadOlderLabel={bn ? "পুরনো মেসেজ" : "Load older messages"}
        empty={
          <EmptyState
            icon={<ForumOutlinedIcon />}
            title={bn ? "এখনো কোনো মেসেজ নেই" : "No messages yet"}
            description={
              bn
                ? "সুপার অ্যাডমিনের সাথে কথোপকথন শুরু করুন।"
                : "Start the conversation with the Super Admin."
            }
          />
        }
      />

      <MessageComposer
        onSend={handleSend}
        placeholder={bn ? "একটি মেসেজ লিখুন…" : "Write a message…"}
        sendLabel={bn ? "পাঠান" : "Send"}
      />
    </Card>
  );
}
