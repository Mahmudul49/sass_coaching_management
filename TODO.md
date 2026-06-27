# Migration TODO: subdomain -> dynamic tenant route

## Plan confirmed
- Tenant admin: `/{tenant}/admin/*`
- Tenant login: `/{tenant}/login`
- Superadmin login/home stays root: `/login`, `/superadmin/*`
- Middleware reads tenant slug from URL path (not subdomain).

## Steps
1. Update tenant resolution utilities — DONE
2. Update auth guards — DONE
3. Update layouts and pages for tenant admin — DONE
4. Recreate tenant admin route structure under `app/[tenant]/admin/*` — DONE
5. Legacy `/admin/*` redirects to `/login` — DONE
6. Tenant login at `app/[tenant]/login/page.tsx` — DONE
7. Middleware uses path parsing (`lib/tenant/paths.ts`); removed `host.ts` — DONE
8. Updated navigation/components for tenant-prefixed paths — DONE
9. Updated revalidatePath in server actions — DONE
10. `npm run build` passes — DONE

## URL examples
| Context | URL |
|---------|-----|
| Super admin | `localhost:3000/superadmin` |
| Tenant site | `localhost:3000/zilani` → `/zilani/admin` |
| Tenant login | `localhost:3000/zilani/login` |
| Production | `sass-coaching-management.vercel.app/zilani` |

## Vercel env
Set `ROOT_DOMAIN=sass-coaching-management.vercel.app` (no protocol).
