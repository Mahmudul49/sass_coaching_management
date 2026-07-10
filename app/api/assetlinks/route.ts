import { NextResponse } from "next/server";

/**
 * Android Digital Asset Links — proves this domain and the installed APK belong
 * together, so the Trusted Web Activity opens fullscreen with NO browser URL bar.
 *
 * Served at /.well-known/assetlinks.json via a rewrite in next.config.mjs.
 *
 * Fill these from the APK's signing key (Bubblewrap/PWABuilder print the SHA-256
 * after generating the key). Set as Vercel env vars — no code redeploy needed to
 * change them:
 *   ANDROID_PACKAGE_NAME  e.g. "app.coaching.manager"
 *   ANDROID_CERT_SHA256   the signing cert fingerprint; comma-separate to allow
 *                         several (e.g. upload key + Play App Signing key)
 */
export const dynamic = "force-dynamic";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || "app.coaching.manager";
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  // Google fetches this as application/json; NextResponse.json sets that header.
  return NextResponse.json(body);
}
