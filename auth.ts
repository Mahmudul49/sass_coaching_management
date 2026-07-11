import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db/connect";
import {
  Collections,
  type Role,
  type TenantDoc,
  type UserDoc,
} from "@/lib/db/collections";
import { verifyPassword } from "@/lib/auth/password";
import { toObjectId } from "@/lib/db/oid";
import { checkRateLimit, recordFailure, clearAttempts, loginKey } from "@/lib/auth/rateLimit";

/**
 * Is the subject behind a live JWT still allowed in? Called periodically from the
 * `jwt` callback so a center/user disabled AFTER sign-in loses access promptly
 * instead of lingering until the token expires.
 *   - admin          → the tenant must still be active;
 *   - console roles  → the platform user must still exist and be active.
 */
async function isSubjectActive(
  role: Role | undefined,
  tenantId: string | null,
  userId: string | undefined
): Promise<boolean> {
  const db = await getDb();
  if (role === "admin") {
    if (!tenantId) return false;
    const _id = toObjectId(tenantId);
    if (!_id) return false;
    const tenant = await db
      .collection<TenantDoc>(Collections.tenants)
      .findOne({ _id }, { projection: { active: 1 } });
    return !!tenant && tenant.active !== false;
  }
  // Central-console roles (superadmin / platform_admin).
  if (!userId) return false;
  const uid = toObjectId(userId);
  if (!uid) return false;
  const user = await db
    .collection<UserDoc>(Collections.users)
    .findOne({ _id: uid, tenantId: null }, { projection: { active: 1, role: 1 } });
  return (
    !!user &&
    user.active !== false &&
    (user.role === "superadmin" || user.role === "platform_admin")
  );
}

/**
 * Auth.js / NextAuth v5 — Credentials provider keyed on PHONE + PASSWORD.
 *
 * Tenant context comes from the `slug` field the login form submits. When `slug`
 * is empty the request is on the root domain (super-admin login). Otherwise we
 * resolve the tenant by slug and look the admin up within that tenant.
 *
 * Note: runs in the Node runtime (route handler / server actions), never on the
 * edge, so the MongoDB driver is available here.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
        slug: { label: "Slug", type: "text" },
      },
      async authorize(credentials) {
        const phone = String(credentials?.phone ?? "").trim();
        const password = String(credentials?.password ?? "");
        const slug = String(credentials?.slug ?? "").trim();
        if (!phone || !password) return null;

        // Brute-force guard. Once an account is locked we refuse before touching
        // the DB — and because this lives in `authorize`, it protects the account
        // no matter how the request arrived (the login form OR a direct POST to
        // the credentials callback). On any failure below we record an attempt;
        // on success we clear the counter.
        const key = loginKey(slug, phone);
        if ((await checkRateLimit(key)).blocked) return null;

        const db = await getDb();

        if (slug) {
          // Tenant admin login.
          const tenant = await db
            .collection<TenantDoc>(Collections.tenants)
            .findOne({ slug });
          if (!tenant || tenant.active === false) {
            await recordFailure(key);
            return null;
          }

          const tenantId = tenant._id.toString();
          const user = await db
            .collection<UserDoc>(Collections.users)
            .findOne({ tenantId, phone, role: "admin" });
          if (!user) {
            await recordFailure(key);
            return null;
          }

          const ok = await verifyPassword(password, user.passwordHash);
          if (!ok) {
            await recordFailure(key);
            return null;
          }

          await clearAttempts(key);
          return {
            id: user._id.toString(),
            name: user.name,
            role: "admin",
            tenantId,
            centerName: tenant.name,
          };
        }

        // Central-console login (root domain, tenantId null): a superadmin or a
        // platform_admin. Disabled accounts (active === false) cannot sign in.
        const user = await db
          .collection<UserDoc>(Collections.users)
          .findOne({
            tenantId: null,
            phone,
            role: { $in: ["superadmin", "platform_admin"] },
          });
        if (!user || user.active === false) {
          await recordFailure(key);
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          await recordFailure(key);
          return null;
        }

        await clearAttempts(key);
        return {
          id: user._id.toString(),
          name: user.name,
          role: user.role,
          tenantId: null,
          centerName: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in: stamp the token and remember when we last validated it.
        token.userId = user.id as string;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.centerName = user.centerName;
        (token as { checkedAt?: number }).checkedAt = Date.now();
        return token;
      }

      // Every later request re-confirms the subject is still enabled, at most
      // once per REVALIDATE_MS so it costs ~1 tiny read per minute per session.
      // Returning null revokes the session (clears the cookie), so deactivating
      // a center/user takes effect within ~1 min instead of at token expiry.
      const t = token as {
        checkedAt?: number;
        role?: Role;
        tenantId?: string | null;
        userId?: string;
      };
      const REVALIDATE_MS = 60_000;
      if (typeof t.checkedAt === "number" && Date.now() - t.checkedAt < REVALIDATE_MS) {
        return token;
      }
      try {
        const active = await isSubjectActive(t.role, t.tenantId ?? null, t.userId);
        if (!active) return null; // revoked → signed out everywhere
        t.checkedAt = Date.now();
      } catch {
        // Keep the session on transient DB errors (fail-open) — an infra hiccup
        // must not sign everyone out.
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as Role;
      session.user.tenantId = (token.tenantId as string | null) ?? null;
      session.user.centerName = (token.centerName as string | null) ?? null;
      return session;
    },
  },
});
