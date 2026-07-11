"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Snackbar from "@mui/material/Snackbar";
import Slide, { type SlideProps } from "@mui/material/Slide";
import Alert, { type AlertColor } from "@mui/material/Alert";

function SlideUp(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

/**
 * Lightweight global toast (MUI Snackbar). Every action calls `toast.success`
 * or `toast.error` for feedback (design principle #3).
 */
type ToastFn = (message: string) => void;
type ToastApi = {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertColor>("success");

  const show = useCallback((msg: string, sev: AlertColor) => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const api: ToastApi = {
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
    warning: (m) => show(m, "warning"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        TransitionComponent={SlideUp}
        sx={{ bottom: { xs: 80, md: 24 } }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{
            width: "100%",
            alignItems: "center",
            borderRadius: 2.5,
            fontWeight: 600,
            boxShadow: "0 12px 32px -10px rgba(17,34,29,0.4)",
            "& .MuiAlert-icon": { alignItems: "center" },
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
