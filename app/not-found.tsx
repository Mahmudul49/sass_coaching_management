import Link from "next/link";

// Shown for unknown tenant subdomains and any unmatched route.
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: "'Hind Siliguri','Noto Sans Bengali',sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 48, margin: 0 }}>৪০৪</h1>
      <p style={{ color: "#555", margin: 0 }}>
        পেজটি খুঁজে পাওয়া যায়নি অথবা এই ঠিকানায় কোনো সেন্টার নেই।
      </p>
      <Link href="/login" style={{ color: "#0f766e", fontWeight: 600 }}>
        লগইন পেজে যান
      </Link>
    </main>
  );
}
