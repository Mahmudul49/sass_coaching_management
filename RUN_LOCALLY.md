# Run Locally — Step-by-Step Manual

A complete guide to running **sass_coaching_management** on your own machine,
from a fresh clone to logging in as the super admin.

---

## 0. Prerequisites (install once)

| Tool | Version | Check command |
|---|---|---|
| **Node.js** | 18.18+ (22 recommended) | `node --version` |
| **npm** | comes with Node | `npm --version` |
| **Git** | any recent | `git --version` |

A modern browser (Chrome / Edge / Firefox). No hosts-file editing is needed —
browsers resolve `*.localhost` to your machine automatically.

---

## 1. Get the code

If you already have the folder, skip this. Otherwise:

```bash
git clone https://github.com/Mahmudul49/sass_coaching_management.git
cd sass_coaching_management
```

---

## 2. Install dependencies

```bash
npm install
```

This downloads everything into `node_modules` (not committed to git). Takes a
few minutes the first time.

---

## 3. Create your `.env.local` file

The secrets file is **not** in git (on purpose). Create it from the template:

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Then open `.env.local` and fill in real values:

```ini
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/coaching_center"
AUTH_SECRET="<paste a long random string>"
NEXTAUTH_URL="http://localhost:3000"
ROOT_DOMAIN="localhost:3000"

SUPERADMIN_PHONE="01700000000"
SUPERADMIN_PASSWORD="choose-a-strong-password"
SUPERADMIN_NAME="Super Admin"

SMS_PROVIDER="stub"
SMS_API_URL=""
SMS_API_KEY=""
SMS_SENDER_ID=""
```

**Generate `AUTH_SECRET`** (any one of these):

```bash
# Git Bash / Linux / macOS
openssl rand -base64 32

# Node (works everywhere)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ For MongoDB Atlas: make sure your current IP is allowed under
> **Atlas → Network Access** (or use `0.0.0.0/0` for dev), or the connection
> will time out.

---

## 4. Prepare the database (one time per database)

```bash
npm run db:indexes        # creates all indexes on Atlas
npm run seed:superadmin   # creates the super-admin login from your .env.local
```

You should see:

```
✅ Indexes ensured
✅ Super admin created (phone: 01700000000)
```

`seed:superadmin` is safe to re-run — it just updates the name/password for the
configured phone.

---

## 5. (Optional) Prove tenant isolation works

```bash
npx tsx scripts/testIsolation.ts
```

Expect: `✅ ALL PASSED: 11 passed, 0 failed`.

---

## 6. Start the dev server

```bash
npm run dev
```

You'll see something like:

```
▲ Next.js 15.5
- Local:   http://localhost:3000
✓ Ready in 4s
```

> If port 3000 is busy, Next picks the next free port (e.g. **3001**) and prints
> it. Use whatever URL it shows. Tenant routing ignores the port number, so this
> is fine.

---

## 7. Open it in the browser

| What | URL |
|---|---|
| **Super admin** (root domain) | `http://localhost:3000` |
| **A tenant center** (subdomain) | `http://{slug}.localhost:3000` |
| Unknown tenant → **404** | `http://nope.localhost:3000` |

- The super admin lives at the **root** domain.
- Each coaching center lives at its own **subdomain** (e.g. a center with slug
  `demo` → `http://demo.localhost:3000`).

> **Group A status:** the pages are placeholders right now — routing, the
> database, and login backend are wired, but the visual UI (login screen,
> dashboards, wizard, tables) arrives in **Group B**. The super-admin account is
> already seeded and ready for that login page.

---

## 8. Stop the server

Press **Ctrl + C** in the terminal running `npm run dev`.

---

## Command cheat-sheet

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server (hot reload) |
| `npm run build` | Production build (catches type errors) |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript check, no compile output |
| `npm run db:indexes` | Create MongoDB indexes |
| `npm run seed:superadmin` | Create/update the super admin |
| `npx tsx scripts/testIsolation.ts` | Tenant-isolation test |

---

## Troubleshooting

**Port already in use / wrong port**
Next auto-switches to the next free port and prints it — just use that URL. To
force port 3000, free it first: find the process on 3000 and stop it.

**`MONGODB_URI is not set`**
You're missing `.env.local`, or it's not in the project root. Re-do step 3. The
standalone scripts read `.env.local` then `.env`.

**MongoDB connection times out**
Your IP isn't whitelisted in Atlas → **Network Access**, or the URI
user/password is wrong.

**Subdomain shows 404**
That's correct until a tenant with that slug exists. The super admin creates
tenants in Group B. Until then only the root domain (`localhost:3000`) renders.

**`.env.local` got committed by mistake**
It shouldn't — `.gitignore` excludes it. If it ever appears in `git status`,
do **not** commit it.

**Changes to `.env.local` don't take effect**
Restart `npm run dev`. Env files are read at server start.
