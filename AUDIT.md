# Mobile Responsiveness Audit — 360px baseline

**Date:** 2026-07-09
**Stack:** Next.js App Router · MUI v6 · MUI X DataGrid · MongoDB Atlas · Auth.js v5
**Method:** Static read of `app/`, `components/`, `lib/theme.ts`, `middleware.ts`, auth + tenant layer, plus a scan for raw `<DataGrid>` / plain `<Dialog>` usage. No code changed for this audit.

> **Important context:** the app was already migrated to a mobile-first shell in prior work — bottom navigation, `ResponsiveTable` (DataGrid↔card), `ResponsiveDialog`, `DataCard`, `StatCard`, skeletons, toasts, confirm dialogs, empty states, PWA manifest/SW all exist. This audit lists only what is **still partial or non-conforming** at 360px, plus deviations from the brief worth a decision.

## Global status

| Concern | State | Notes |
|---|---|---|
| App shell (mobile bottom nav + sticky AppBar, desktop sidebar) | ✅ Done | `AdminShell`. Sidebar is full (not mini-variant) — minor deviation. |
| Theme centralised | ✅ (path differs) | Lives in `lib/theme.ts`, not `src/theme.ts`. Project has no `src/`; moving it would churn every import for no user benefit. **Recommend keep.** |
| Font | ⚠️ Partial | Uses **Hind Siliguri** (renders Bengali conjuncts well) via `next/font` `display:swap`. Brief asks Noto Sans Bengali + Inter. Hind Siliguri already covers Bengali+Latin; swapping is cosmetic. **Recommend keep, or add Inter for Latin only.** |
| `responsiveFontSizes()` | ❌ Missing | Theme not wrapped. Fix in Phase 1. |
| 44px min touch targets | ⚠️ Mostly | Buttons 46/54px, list items 48px, bottom-nav 64px. A few icon-only buttons `size="small"` (<44px) in dense grids. |
| PWA | ✅ Done | `public/manifest.webmanifest` + `public/sw.js` (app-shell cache, prod-only) + `public/icon.svg` (purpose any+maskable). Brief asks `manifest.ts`; static webmanifest is equally valid & installable. |
| Snackbar / confirm / empty / skeleton | ✅ Done | `ToastProvider`, `ConfirmDialog`, `EmptyState`, `Loading` skeletons, `app/[tenant]/admin/loading.tsx`. |
| API / schema / auth / tenant | ✅ Untouched | Out of scope per brief; audit did not flag changes there. |

## Per-page status @360px

| Route | Status | Issue at 360px |
|---|---|---|
| `/login`, `/[tenant]/login` | ✅ OK | Centered card, single column. |
| `/superadmin` | ⚠️ Partial | Tenants table uses `ResponsiveTable` (cards) ✅, but **Create/Edit tenant dialogs are plain centered `<Dialog>`** — not full-screen on mobile. Cramped. |
| `/superadmin/students` (marketing) | ✅ OK | ResponsiveTable cards. |
| `/[tenant]/admin` (dashboard) | ⚠️ Minor | Stat grid is 2/3/6 cols; brief wants 1/2/4. 2-col at 360px is fine (no overflow) but differs. Chart in `overflow-x:auto` container ✅. |
| `/[tenant]/admin/students` | ✅ OK | ResponsiveTable cards + `ResponsiveDialog` form. |
| `/[tenant]/admin/classes` | ❌ Broken | **Raw `<DataGrid>` on mobile** → internal horizontal scroll; edit dialog is plain `<Dialog>`. |
| `/[tenant]/admin/sections` | ❌ Broken | Same as classes — raw DataGrid + plain dialog. |
| `/[tenant]/admin/fees` | ⚠️ Partial | Card list ✅, but **edit dialog is plain `<Dialog>`** with month rows that get tight at 360px. |
| `/[tenant]/admin/attendance` | ✅ OK | Card list + sticky save bar. |
| `/[tenant]/admin/payments` | ✅ OK | Mobile card entry + desktop grid in contained scroll + sticky save-all. Wide grid is desktop-only. |
| `/[tenant]/admin/reports` (payment/matrix/attendance) | ✅ OK | ResponsiveTable + matrix/attendance tables in `overflow-x:auto` (contained, not page scroll). |
| `/[tenant]/admin/setup` (wizard) | ⚠️ Partial | Reuses the managers above, so inherits Classes/Sections DataGrid issue. |
| `/[tenant]/admin/settings` | ✅ OK | Single-column cards. |
| `/[tenant]` , `/` | ✅ OK | Redirect-only. |

## Component-level fixes (drives the phases)

1. **`ClassesManager`** — replace raw DataGrid with `ResponsiveTable` (+ `DataCard` mobile); move edit dialog to `ResponsiveDialog`.
2. **`SectionsManager`** — same treatment.
3. **`FeesManager`** — edit dialog → `ResponsiveDialog` (full-screen on mobile; month/amount rows stack).
4. **`BulkImportDialog`** — → `ResponsiveDialog`; preview table keeps contained horizontal scroll.
5. **`TenantsClient`** — Create + Edit dialogs → `ResponsiveDialog`.
6. **`lib/theme.ts`** — wrap with `responsiveFontSizes()`; ensure icon-only actions meet 44px on touch.
7. **Dashboard** — optional: stat grid to 1/2/4 to match brief exactly.

## Deviations from the brief (recommend keeping)

- **`lib/theme.ts` vs `src/theme.ts`**, **`manifest.webmanifest` vs `manifest.ts`** — functionally equivalent; changing only churns paths. Keeping.
- **Hind Siliguri vs Noto Sans Bengali + Inter** — Hind Siliguri already renders Bengali conjuncts + Latin cleanly. Optional: add Inter for Latin numerals only.
- Path-based tenancy (`/{slug}/admin`) not subdomain — pre-existing architecture, untouched.

## What this audit can NOT certify from static read

- **Lighthouse Accessibility ≥95 / LCP <2.5s / CLS <0.1 / route JS <200KB** — need a real device/Lighthouse run. `next build` reports route JS; admin routes currently ~150–470KB First Load (DataGrid-heavy routes highest) — dynamic-importing DataGrid would help the heavy ones.

## Phase plan

- **Phase 1 — Tables & dialogs (fixes all ❌/⚠️ overflow):** Classes/Sections → ResponsiveTable cards; Fees/Bulk/Tenants dialogs → ResponsiveDialog. `next build`, commit.
- **Phase 2 — Theme polish:** `responsiveFontSizes`, touch-target sweep, dashboard 1/2/4 grid. Build, commit.
- **Phase 3 — Perf:** dynamic-import DataGrid + chart, verify First Load JS drops on heavy routes. Build, commit.
- **Phase 4 — QA:** manual check 360/390/768/1280; confirm zero page-level horizontal scroll.
