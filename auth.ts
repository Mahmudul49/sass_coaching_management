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

/**
 * Auth.js / NextAuth v5 — Credentials provider keyed on PHONE + PASSWORD.
 *
 * Tenant context comes from the `slug` field the login form submits (it knows
 * its own subdomain). When `slug` is empty the request is on the root domain,
 * so we authenticate the single super-admin (tenantId null). Otherwise we
 * resolve the tenant by slug and look the admin up *within that tenant* — phone
 * is only unique per tenant, so the slug is required to disambiguate.
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

        const db = await getDb();

        if (slug) {
          // Tenant admin login.
          const tenant = await db
            .collection<TenantDoc>(Collections.tenants)
            .findOne({ slug });
          if (!tenant || tenant.active === false) return null;

          const tenantId = tenant._id.toString();
          const user = await db
            .collection<UserDoc>(Collections.users)
            .findOne({ tenantId, phone, role: "admin" });
          if (!user) return null;

          const ok = await verifyPassword(password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user._id.toString(),
            name: user.name,
            role: "admin",
            tenantId,
            centerName: tenant.name,
          };
        }

        // Super-admin login (root domain, tenantId null).
        const user = await db
          .collection<UserDoc>(Collections.users)
          .findOne({ tenantId: null, phone, role: "superadmin" });
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          role: "superadmin",
          tenantId: null,
          centerName: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.centerName = user.centerName;
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
