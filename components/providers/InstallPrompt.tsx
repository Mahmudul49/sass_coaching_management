"use client";
import { useEffect, useState } from "react";
import Slide from "@mui/material/Slide";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import IosShareIcon from "@mui/icons-material/IosShare";
import { useI18n } from "@/components/providers/I18nProvider";

/** The Chrome/Android `beforeinstallprompt` event (not in lib.dom types). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 14;

function dismissedRecently() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    return !!v && Date.now() - Number(v) < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}
function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function isIos() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/**
 * App-install nudge. On Chrome/Android it captures `beforeinstallprompt` and
 * offers a one-tap Install; on iOS Safari (which has no such event) it shows the
 * manual "Add to Home Screen" hint. Never shown when already installed, and
 * dismissals are remembered so it doesn't nag.
 */
export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<null | "android" | "ios">(null);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onBIP = (e: Event) => {
      e.preventDefault(); // stop Chrome's default mini-infobar; we show our own
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS has no beforeinstallprompt — offer manual instructions after a beat.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) iosTimer = setTimeout(() => setMode((m) => m ?? "ios"), 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore private-mode storage errors */
    }
    setMode(null);
    setDeferred(null);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    dismiss();
  };

  if (!mode) return null;

  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        role="dialog"
        aria-label={t("pwa_install_title")}
        sx={{
          position: "fixed",
          left: { xs: 12, sm: "auto" },
          right: { xs: 12, sm: 20 },
          bottom: { xs: "calc(12px + env(safe-area-inset-bottom))", md: 20 },
          zIndex: (th) => th.zIndex.snackbar + 1,
          width: { sm: 380 },
          p: 1.75,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2.5,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(135deg,#0A5A4E,#0F7A6B)",
            color: "#fff",
          }}
        >
          {mode === "ios" ? <IosShareIcon /> : <InstallMobileIcon />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={700} sx={{ lineHeight: 1.25 }} noWrap>
            {mode === "ios" ? t("pwa_ios_title") : t("pwa_install_title")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {mode === "ios" ? t("pwa_ios_body") : t("pwa_install_body")}
          </Typography>
        </Box>
        {mode === "android" && (
          <Button size="small" onClick={install} sx={{ flexShrink: 0 }}>
            {t("pwa_install_btn")}
          </Button>
        )}
        <IconButton size="small" aria-label={t("pwa_later")} onClick={dismiss} sx={{ flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Slide>
  );
}
