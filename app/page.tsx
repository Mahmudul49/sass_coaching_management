import { getTenantSlug, getTenantBySlug } from "@/lib/tenant/server";
import { notFound } from "next/navigation";

/**
 * Root landing. Placeholder for Group A so the app builds and so tenant
 * resolution can be smoke-tested:
 *   - On the root domain (no slug) this is the super-admin entry point.
 *   - On a subdomain it confirms the slug resolves to a real tenant, else 404.
 * The real super-admin / tenant landing UIs arrive in Group B.
 */
export default async function Home() {
  const slug = await getTenantSlug();

  if (!slug) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Coaching Management — Super Admin</h1>
        <p>Group A infrastructure is live. Super-admin UI comes in Group B.</p>
      </main>
    );
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <main style={{ padding: 24 }}>
      <h1>{tenant.name}</h1>
      <p>
        Tenant <strong>{tenant.slug}</strong> resolved. Admin UI comes in Group B.
      </p>
    </main>
  );
}
