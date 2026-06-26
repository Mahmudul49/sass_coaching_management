import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Coaching Management",
  description: "Multi-tenant coaching center management",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, 'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
