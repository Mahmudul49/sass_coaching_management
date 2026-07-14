import type { Db } from "mongodb";
import { Collections } from "./collections";

/**
 * Create every index the app relies on. Idempotent — Mongo ignores a
 * createIndex call for an index that already exists with the same spec.
 *
 * Every tenant-scoped query leads with `tenantId`, so every index does too.
 * This is what keeps M0 (512MB) responsive at 15k+ students.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    // tenants: slug is the subdomain and must be globally unique.
    db.collection(Collections.tenants).createIndex({ slug: 1 }, { unique: true }),

    // users: phone unique *within* a tenant (superadmin has tenantId null).
    db
      .collection(Collections.users)
      .createIndex({ tenantId: 1, phone: 1 }, { unique: true }),

    // classes / sections / feeStructure
    db.collection(Collections.classes).createIndex({ tenantId: 1, order: 1 }),
    db.collection(Collections.sections).createIndex({ tenantId: 1, classId: 1 }),
    db
      .collection(Collections.feeStructure)
      .createIndex({ tenantId: 1, classId: 1 }, { unique: true }),

    // students
    db.collection(Collections.students).createIndex({ tenantId: 1, classId: 1 }),
    // {tenantId, active, classId}: serves the `{tenantId, active}` status filter
    // (prefix) AND *covers* the dashboard's per-class active-count aggregation
    // (`getActiveCountsByClass`: match tenantId+active, group classId) as an
    // index-only scan — no per-document fetch of the 100k students collection on
    // every dashboard load. Supersedes the old narrow {tenantId, active}; that
    // one is now redundant and can be dropped once (see scripts/ensureIndexes).
    db.collection(Collections.students).createIndex({ tenantId: 1, active: 1, classId: 1 }),
    // Operational modules load active students of a class (payment/attendance/report).
    db.collection(Collections.students).createIndex({ tenantId: 1, classId: 1, active: 1 }),

    // attendance
    db
      .collection(Collections.attendance)
      .createIndex({ tenantId: 1, classId: 1, date: 1 }),
    db
      .collection(Collections.attendance)
      .createIndex({ tenantId: 1, studentId: 1 }),
    // One status per student per date — makes save an idempotent upsert.
    db
      .collection(Collections.attendance)
      .createIndex(
        { tenantId: 1, classId: 1, date: 1, studentId: 1 },
        { unique: true }
      ),

    // payments
    db
      .collection(Collections.payments)
      .createIndex({ tenantId: 1, classId: 1, year: 1, month: 1 }),
    db.collection(Collections.payments).createIndex({ tenantId: 1, studentId: 1 }),
    // Report range + status filter (year*100+month scan within a tenant/status).
    db.collection(Collections.payments).createIndex({ tenantId: 1, status: 1, year: 1, month: 1 }),
    // Dashboard: the per-month collection aggregation matches {tenantId, year}
    // and groups by month. No class/status prefix, so the indexes above don't
    // serve it — this one turns a full tenant scan into an index scan.
    db.collection(Collections.payments).createIndex({ tenantId: 1, year: 1, month: 1 }),
    // Dashboard: "collected today" matches {tenantId, paidAt} on a date window;
    // also serves any recent-payments view. paidAt is optional, so index sparsely.
    db.collection(Collections.payments).createIndex({ tenantId: 1, paidAt: -1 }, { sparse: true }),
    // One payment record per student per month/year — upsert target.
    db
      .collection(Collections.payments)
      .createIndex(
        { tenantId: 1, studentId: 1, year: 1, month: 1 },
        { unique: true }
      ),

    // feeOverride: one payable override per student per month/year — upsert target.
    db
      .collection(Collections.feeOverride)
      .createIndex({ tenantId: 1, studentId: 1, year: 1, month: 1 }, { unique: true }),
    db.collection(Collections.feeOverride).createIndex({ tenantId: 1, studentId: 1 }),

    // smsLog
    db.collection(Collections.smsLog).createIndex({ tenantId: 1, sentAt: -1 }),

    // themeSettings: a single global console theme doc keyed by scope.
    db.collection(Collections.themeSettings).createIndex({ scope: 1 }, { unique: true }),

    // messaging: one conversation per tenant (upsert target); super inbox sorts
    // by most-recent activity.
    db.collection(Collections.conversations).createIndex({ tenantId: 1 }, { unique: true }),
    db.collection(Collections.conversations).createIndex({ lastMessageAt: -1 }),
    // messages: load a conversation thread newest-first, paginate by _id.
    db.collection(Collections.messages).createIndex({ tenantId: 1, _id: -1 }),
    db.collection(Collections.messages).createIndex({ conversationId: 1, _id: -1 }),

    // auditLog: recent-first, and per-center history.
    db.collection(Collections.auditLog).createIndex({ createdAt: -1 }),
    db.collection(Collections.auditLog).createIndex({ tenantId: 1, createdAt: -1 }),

    // ── Results module ──────────────────────────────────────────────────────
    // subjects: list a class's subjects in display order.
    db.collection(Collections.subjects).createIndex({ tenantId: 1, classId: 1, order: 1 }),
    // exams: the class exam list, and the dashboard's status/date views.
    db.collection(Collections.exams).createIndex({ tenantId: 1, classId: 1, status: 1 }),
    db.collection(Collections.exams).createIndex({ tenantId: 1, status: 1, date: -1 }),
    // marks: one record per student per exam — the bulk-upsert target. This
    // unique compound also serves "all marks for an exam" (tenantId+examId prefix).
    db
      .collection(Collections.marks)
      .createIndex({ tenantId: 1, examId: 1, studentId: 1 }, { unique: true }),
    // marks: a student's result history across exams.
    db.collection(Collections.marks).createIndex({ tenantId: 1, studentId: 1 }),
    // examSettings: a single settings doc per tenant.
    db.collection(Collections.examSettings).createIndex({ tenantId: 1, scope: 1 }, { unique: true }),
  ]);
}
