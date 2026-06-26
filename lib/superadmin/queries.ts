import "server-only";
import { getDb } from "@/lib/db/connect";
import { Collections, type TenantDoc } from "@/lib/db/collections";

/**
 * Super-admin-only queries. These intentionally span ALL tenants, so they use
 * the raw db (NOT the scoped layer). Only super-admin code may import this.
 */

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  adminName: string;
  adminPhone: string;
  active: boolean;
  studentCount: number;
  createdAt: string;
};

export type SuperAdminStats = {
  totalTenants: number;
  activeTenants: number;
  totalAdmins: number;
  totalActiveStudents: number;
};

export async function getSuperAdminStats(): Promise<SuperAdminStats> {
  const db = await getDb();
  const [totalTenants, activeTenants, totalAdmins, totalActiveStudents] =
    await Promise.all([
      db.collection(Collections.tenants).countDocuments({}),
      db.collection(Collections.tenants).countDocuments({ active: true }),
      db.collection(Collections.users).countDocuments({ role: "admin" }),
      db.collection(Collections.students).countDocuments({ active: true }),
    ]);
  return { totalTenants, activeTenants, totalAdmins, totalActiveStudents };
}

export async function listTenants(): Promise<TenantRow[]> {
  const db = await getDb();
  const tenants = await db
    .collection<TenantDoc>(Collections.tenants)
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  // Active student counts grouped by tenant in one pass.
  const counts = await db
    .collection(Collections.students)
    .aggregate<{ _id: string; n: number }>([
      { $match: { active: true } },
      { $group: { _id: "$tenantId", n: { $sum: 1 } } },
    ])
    .toArray();
  const countMap = new Map(counts.map((c) => [c._id, c.n]));

  return tenants.map((t) => ({
    id: t._id.toString(),
    slug: t.slug,
    name: t.name,
    adminName: t.adminName,
    adminPhone: t.adminPhone,
    active: t.active,
    studentCount: countMap.get(t._id.toString()) ?? 0,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : "",
  }));
}
