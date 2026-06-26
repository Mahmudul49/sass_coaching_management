# sass_coaching_management

Multi-tenant **Coaching Management SaaS** for coaching centers in Bangladesh.
Bengali UI, mobile-first, built for non-technical center owners.

> **Status:** Group A complete (database, auth, tenant isolation). Group B
> (super-admin UI, admin setup wizard, master data + bulk import, attendance,
> payments + receipts, due report + Excel export, shared MUI layout) in progress.

## Stack

- **Next.js** (App Router) + **TypeScript** — frontend + serverless backend
- **Material UI** + **MUI X DataGrid**
- **MongoDB Atlas** (M0 free tier)
- **Auth.js / NextAuth v5** — Credentials provider (phone + password)
- **xlsx** (SheetJS) — Excel import/export
- **Vercel** — deploy

## Architecture: tenant isolation

MongoDB has no row-level security, so isolation is enforced in the app layer:

- Every collection except `tenants` (and the super-admin row in `users`) carries
  a string `tenantId`.
- `lib/db/scoped.ts` exports **`forTenant(tenantId)`** — every read/write
  auto-injects `{ tenantId }`, forced last so a caller can never override it.
  Route handlers and server actions use **only** this layer, never the raw DB.
- `middleware.ts` parses the subdomain → slug at the edge (the Mongo driver can't
  run on the Edge runtime).
- `lib/tenant/server.ts` (`requireTenant`) does the DB-backed check in the Node
  runtime: unknown slug → **404**; `lib/auth/guards.ts` returns **403** when a
  session's `tenantId` doesn't match the subdomain.

Prove it: `npx tsx scripts/testIsolation.ts` (11 assertions, no cross-tenant leak).

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Var | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string (DB name in the path) |
| `AUTH_SECRET` | NextAuth secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL (`http://localhost:3000` in dev) |
| `ROOT_DOMAIN` | Apex domain w/o protocol. Dev: `localhost:3000`. Prod: `yourdomain.com`. Subdomains become tenant slugs. |
| `SUPERADMIN_PHONE` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | Seeded super-admin login |
| `SMS_PROVIDER` / `SMS_API_URL` / `SMS_API_KEY` / `SMS_SENDER_ID` | SMS gateway (default `stub` = no-op log) |

## Local development

```bash
npm install
npm run db:indexes        # create indexes on Atlas (also created lazily at runtime)
npm run seed:superadmin   # create/update the super-admin from env
npm run dev               # http://localhost:3000
```

- Super admin lives at the **root** domain: `http://localhost:3000`
- A tenant lives at its **subdomain**: `http://{slug}.localhost:3000`
  (modern browsers resolve `*.localhost` to 127.0.0.1 automatically — no hosts
  file editing needed).

## Deploying to Vercel (wildcard subdomains)

1. Import the repo into Vercel and add all env vars (set `ROOT_DOMAIN` to your
   apex, e.g. `yourdomain.com`, and `NEXTAUTH_URL` to `https://yourdomain.com`).
2. Add domains in Vercel: the apex `yourdomain.com` **and** the wildcard
   `*.yourdomain.com`.
3. DNS:
   - `A` / `CNAME` for the apex per Vercel's instructions.
   - `CNAME` `*` → `cname.vercel-dns.com` (wildcard subdomain).
4. Each tenant created by the super admin goes live at `{slug}.yourdomain.com`.

## Seeding the super admin

```bash
npm run seed:superadmin
```

Idempotent — re-running updates the password/name for the configured phone. The
super-admin has `tenantId: null` and is the only account at the root domain.

## MongoDB M0 (free tier) scaling notes

- Designed for ~100 tenants / 15,000+ students on M0 (512 MB, 100 connections).
- Connection is cached per serverless container with a small pool (`maxPoolSize: 5`).
- Every tenant-scoped query is backed by a `tenantId`-leading compound index
  (see `lib/db/indexes.ts`); paginate server-side via MUI DataGrid.
- Keep documents small and flat.

## Plugging in a real SMS provider

`lib/sms/index.ts` exposes `sendSms({ to, body, tenantId, studentId, kind })`.
The default `stub` provider just writes an `smsLog` doc so the app runs at $0 in
dev. To use a real Bangladeshi gateway, set `SMS_PROVIDER` + `SMS_API_URL` +
`SMS_API_KEY` + `SMS_SENDER_ID` — no call sites change.

> **Cost note:** 15,000 students = 15,000 SMS per attendance round. Attendance
> SMS is **off by default** per tenant (`tenants.attendanceSmsEnabled`); payment
> SMS stays on.

_(SMS module + UI land in Group B.)_
