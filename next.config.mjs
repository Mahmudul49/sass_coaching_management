/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project (a stray bun.lock one level up was
  // confusing Next's auto-detection).
  outputFileTracingRoot: import.meta.dirname,
  // Keep the native MongoDB driver and bcrypt out of the client/edge bundle.
  serverExternalPackages: ["mongodb", "bcryptjs"],
  experimental: {
    // Enables next/navigation `forbidden()` / `unauthorized()` (403 / 401).
    authInterrupts: true,
  },
  // Serve the Android Digital Asset Links file at the exact well-known path a
  // Trusted Web Activity (the APK) looks for, backed by an env-driven route.
  async rewrites() {
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
};

export default nextConfig;
