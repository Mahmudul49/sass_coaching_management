import "server-only";
import { getDb } from "@/lib/db/connect";
import {
  Collections,
  type ClassDoc,
  type SectionDoc,
  type StudentDoc,
  type TenantDoc,
} from "@/lib/db/collections";

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

/** Cross-tenant student row for super-admin marketing / outreach. */
export type MarketingStudentRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  name: string;
  roll: string;
  phone: string;
  className: string;
  sectionName: string;
  active: boolean;
  createdAt: string;
};

export type MarketingStudentFilter = {
  query?: string;
  tenantId?: string;
  activeOnly?: boolean;
};

const MARKETING_STUDENT_LIMIT = 1000;

/** Search students across all tenants (super-admin marketing use). */
export async function searchMarketingStudents(
  filter: MarketingStudentFilter = {}
): Promise<{ rows: MarketingStudentRow[]; total: number }> {
  const db = await getDb();

  const match: Record<string, unknown> = {};
  if (filter.tenantId) match.tenantId = filter.tenantId;
  if (filter.activeOnly !== false) match.active = true;

  const q = filter.query?.trim();
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "i");
    match.$or = [{ name: re }, { phone: re }, { roll: re }];
  }

  const [students, total, tenants, classes, sections] = await Promise.all([
    db
      .collection<StudentDoc>(Collections.students)
      .find(match, {
        projection: {
          tenantId: 1,
          name: 1,
          roll: 1,
          phone: 1,
          classId: 1,
          sectionId: 1,
          active: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(MARKETING_STUDENT_LIMIT)
      .toArray(),
    db.collection(Collections.students).countDocuments(match),
    db.collection<TenantDoc>(Collections.tenants).find({}).toArray(),
    db.collection<ClassDoc>(Collections.classes).find({}).toArray(),
    db.collection<SectionDoc>(Collections.sections).find({}).toArray(),
  ]);

  const tenantMap = new Map(tenants.map((t) => [t._id.toString(), t]));
  const classMap = new Map(classes.map((c) => [c._id.toString(), c.name]));
  const sectionMap = new Map(sections.map((s) => [s._id.toString(), s.name]));

  const rows: MarketingStudentRow[] = students.map((s) => {
    const tenant = tenantMap.get(s.tenantId);
    return {
      id: s._id.toString(),
      tenantId: s.tenantId,
      tenantName: tenant?.name ?? "—",
      tenantSlug: tenant?.slug ?? "",
      name: s.name,
      roll: s.roll,
      phone: s.phone,
      className: classMap.get(s.classId) ?? "—",
      sectionName: sectionMap.get(s.sectionId) ?? "—",
      active: s.active !== false,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : "",
    };
  });

  return { rows, total };
}
