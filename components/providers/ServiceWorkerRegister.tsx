"use client";
import { useEffect } from "react";

/**
 * Registers the app-shell service worker (production only) so the app loads
 * fast on repeat visits over weak mobile connections. In dev we actively
 * unregister to avoid stale-cache confusion.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
  }, []);

  return null;
}
