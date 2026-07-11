import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Hind_Siliguri } from "next/font/google";
import ThemeRegistry from "@/components/providers/ThemeRegistry";
import ServiceWorkerRegister from "@/components/providers/ServiceWorkerRegister";
import InstallPrompt from "@/components/providers/InstallPrompt";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { getLocale } from "@/lib/i18n/server";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-bengali",
});

export const metadata: Metadata = {
  title: "Coaching Manager",
  description: "Multi-tenant coaching center management",
  manifest: "/manifest.webmanifest",
  applicationName: "Coaching Manager",
  appleWebApp: { capable: true, title: "Coaching Manager", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F7A6B",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={hindSiliguri.variable}>
      <body style={{ margin: 0 }}>
        <ThemeRegistry>
          <I18nProvider initialLocale={locale}>
            {children}
            <InstallPrompt />
          </I18nProvider>
        </ThemeRegistry>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
