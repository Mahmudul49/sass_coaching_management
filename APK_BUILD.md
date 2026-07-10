# Build the Android APK for coaching clients

The app is a **PWA**. The Android app is a thin native wrapper (a **Trusted Web
Activity**) that opens your *deployed* site fullscreen with no browser bar. It
does **not** contain the app code — it loads your live URL — so two things are
required before an APK can exist:

1. **The app must be deployed to a public HTTPS URL** (e.g. Vercel). An APK
   pointing at `localhost` cannot work on your clients' phones.
2. **The APK must be signed and paired to that domain** via
   `/.well-known/assetlinks.json` (already wired in this repo — see step 4).

> One APK serves **every** coaching center. Tenants are just paths
> (`/{slug}/admin`), so the same app opens each center's login.

---

## Step 1 — Deploy the PWA (once)

Deploy to Vercel (or any HTTPS host). Confirm these are reachable in a browser:

- `https://YOUR-DOMAIN/manifest.webmanifest`
- `https://YOUR-DOMAIN/icon-512.png` and `/icon-maskable-512.png`

Set `NEXTAUTH_URL` / `ROOT_DOMAIN` to the production domain in Vercel env.

---

## Step 2 — Generate the APK

### Path A — PWABuilder (recommended, **no tools to install**)

1. Go to <https://www.pwabuilder.com>, enter `https://YOUR-DOMAIN`, **Start**.
2. **Package for stores → Android**. Keep "Trusted Web Activity". The suggested
   Package ID is `app.coaching.manager` (keep it consistent — see step 4).
3. **Download**. You get:
   - `app-release-signed.apk` → the **APK** you send to clients (sideload).
   - `app-release-bundle.aab` → for **Google Play** (optional).
   - `assetlinks.json` → its `sha256_cert_fingerprints` value is what you need
     in step 4.
   - `signing.keystore` + passwords → **back these up safely**; you need the
     same key to ship updates.

### Path B — Bubblewrap CLI (local, needs JDK 17 + Android SDK)

```bash
npm i -g @bubblewrap/cli
# First run downloads/points to a JDK + Android SDK:
bubblewrap doctor

# This repo already contains twa-manifest.json — set your host in it first,
# then from the repo root:
#   (edit twa-manifest.json: replace every <YOUR-DOMAIN> with your host)
bubblewrap build      # prompts to create a signing key on first run

# Outputs: app-release-signed.apk  and  app-release-bundle.aab
# Print the signing fingerprint for step 4:
bubblewrap fingerprint
```

---

## Step 3 — (Get the signing fingerprint)

- **PWABuilder**: open the downloaded `assetlinks.json`; copy the
  `sha256_cert_fingerprints` value (`AA:BB:CC:...`).
- **Bubblewrap**: run `bubblewrap fingerprint`.
- If you later publish to **Google Play**, also copy the **App Signing** SHA-256
  from Play Console → *Setup → App integrity* (Play re-signs your app).

---

## Step 4 — Pair the domain (hides the URL bar)

This repo serves `/.well-known/assetlinks.json` from an env-driven route
(`app/api/assetlinks/route.ts`, rewritten in `next.config.mjs`). Just set two
Vercel env vars — **no code change, no redeploy of code**:

```
ANDROID_PACKAGE_NAME = app.coaching.manager
ANDROID_CERT_SHA256  = AA:BB:CC:...        # comma-separate multiple keys
```

Redeploy (or it picks up on next deploy) and verify:

```bash
curl https://YOUR-DOMAIN/.well-known/assetlinks.json
# → package_name + your fingerprint, served as application/json
```

If this is wrong/missing, the app still works but shows a browser address bar.

---

## Step 5 — Give it to coaching clients

**Sideload (simplest, no Play Store):**
1. Send them `app-release-signed.apk` (WhatsApp / download link).
2. On the phone: open it → allow *"Install unknown apps"* for that app → Install.
3. It appears on the home screen as **কোচিং** and opens fullscreen.
4. They log in at their center's page as usual.

**Google Play (optional, more trusted):** create a Play Console app, upload the
`.aab`, and after review clients install from the Play Store. (Requires a
one-time $25 Google developer account.)

---

## Updating the app later

- **Content/feature changes** need **no new APK** — just deploy the website; the
  app loads the latest automatically (it's the live site).
- Only rebuild the APK when you change the **icon, name, or package** — bump
  `appVersionCode`/`appVersion`, rebuild **with the same signing key**, redistribute.
