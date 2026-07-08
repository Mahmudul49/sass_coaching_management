import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Hind_Siliguri } from "next/font/google";
import ThemeRegistry from "@/components/providers/ThemeRegistry";
import ServiceWorkerRegister from "@/components/providers/ServiceWorkerRegister";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-bengali",
});

export const metadata: Metadata = {
  title: "কোচিং ম্যানেজমেন্ট",
  description: "মাল্টি-টেন্যান্ট কোচিং সেন্টার ম্যানেজমেন্ট",
  manifest: "/manifest.webmanifest",
  applicationName: "কোচিং ম্যানেজমেন্ট",
  appleWebApp: { capable: true, title: "কোচিং", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F7A6B",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={hindSiliguri.variable}>
      <body style={{ margin: 0 }}>
        <ThemeRegistry>{children}</ThemeRegistry>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
