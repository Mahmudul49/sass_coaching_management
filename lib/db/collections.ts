import type { ObjectId } from "mongodb";

/**
 * Collection names (single source of truth) and document shapes.
 *
 * Convention: every collection EXCEPT `tenants` and the super-admin row in
 * `users` carries a string `tenantId` (the tenant's `_id` as a hex string).
 * The scoped query layer (`lib/db/scoped.ts`) is what actually enforces that
 * `tenantId` is injected into every read and write.
 */

export const Collections = {
  tenants: "tenants",
  users: "users",
  classes: "classes",
  sections: "sections",
  feeStructure: "feeStructure",
  feeOverride: "feeOverride",
  students: "students",
  attendance: "attendance",
  payments: "payments",
  smsLog: "smsLog",
  themeSettings: "themeSettings",
  conversations: "conversations",
  messages: "messages",
  auditLog: "auditLog",
  // Results module (exams / marks / grading). All tenant-scoped like the rest.
  subjects: "subjects",
  exams: "exams",
  marks: "marks",
  examSettings: "examSettings",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];

/**
 * Roles:
 *   - superadmin     — full central-console access (tenantId null).
 *   - platform_admin — restricted central-console staff (tenantId null).
 *   - admin          — a per-coaching-center tenant admin (tenantId set).
 */
export type Role = "superadmin" | "platform_admin" | "admin";

export type TenantDoc = {
  _id: ObjectId;
  slug: string; // unique, lowercase, the subdomain label
  name: string; // center name shown in the UI
  adminName: string;
  adminPhone: string;
  active: boolean;
  // Real-world cost control: 15k students => 15k SMS per attendance round.
  // Attendance SMS is OFF by default; payment SMS is always on.
  attendanceSmsEnabled: boolean;
  createdAt: Date;
};

export type UserDoc = {
  _id: ObjectId;
  tenantId: string | null; // null for platform users (superadmin / platform_admin)
  name: string;
  phone: string;
  passwordHash: string;
  role: Role;
  // Platform-user activation flag. Absent (legacy) or true = active; only an
  // explicit `false` disables login. Tenant admins are gated by tenant.active.
  active?: boolean;
};

export type ClassDoc = {
  _id: ObjectId;
  tenantId: string;
  name: string;
  order: number;
};

export type SectionDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  name: string;
};

// `month` (1-12) binds a fee to a specific month; undefined = every month (legacy).
export type FeeComponent = { label: string; amount: number; month?: number };

// `enabled` toggles a model test on/off without losing the amount; undefined = on (legacy).
export type ModelTestFee = { amount: number; month: number; enabled?: boolean };

export type FeeStructureDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  admissionFee: number;
  admissionMonth?: number; // which month admission is charged; undefined = every month (legacy)
  monthlyFee: number;
  modelTestHalfYearly: ModelTestFee; // month 1-12
  modelTestAnnual: ModelTestFee;
  others: FeeComponent[];
};

export type StudentDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  sectionId: string;
  name: string;
  roll: string;
  phone: string;
  active: boolean;
  createdAt: Date;
};

/**
 * Per-student, per-month payable override. When present it REPLACES the class
 * fee structure for that student-month (used by all fee calculations & reports).
 * `payable = 0` means the student is Not Enrolled that month (excluded from
 * payable/due/collection). Absence = fall back to the class fee structure.
 */
export type FeeOverrideDoc = {
  _id: ObjectId;
  tenantId: string;
  studentId: string;
  year: number;
  month: number; // 1-12
  payable: number; // >=0; 0 = Not Enrolled
  updatedAt: Date;
};

export type AttendanceStatus = "present" | "absent";

export type AttendanceDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  status: AttendanceStatus;
};

export type PaymentComponent = { type: string; label: string; amount: number };
export type PaymentStatus = "paid" | "partial" | "unpaid";

export type PaymentDoc = {
  _id: ObjectId;
  tenantId: string;
  studentId: string;
  classId: string;
  year: number;
  month: number; // 1-12
  components: PaymentComponent[];
  totalAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  paidAt: Date | null;
  remarks?: string; // optional teacher note on student progress
};

export type SmsKind =
  | "attendance_present"
  | "attendance_absent"
  | "payment_received"
  | "payment_due"
  // Sent (in batch) to guardians when an exam's results are published.
  | "result_published";

export type SmsLogDoc = {
  _id: ObjectId;
  tenantId: string;
  studentId: string | null;
  phone: string;
  body: string;
  kind: SmsKind;
  sentAt: Date;
  ok: boolean;
};

/**
 * Central-console theme (SuperAdmin Theme Builder). A single global document
 * (`scope: "console"`) holding a light + dark palette of design tokens. Only
 * the central back-office consumes this; tenant UIs keep their built-in theme.
 */
export type ThemePalette = {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  text: string;
  border: string;
  sidebar: string;
  navbar: string;
  button: string;
};

export type ThemeDoc = {
  _id: ObjectId;
  scope: "console";
  light: ThemePalette;
  dark: ThemePalette;
  updatedAt: Date;
};

/**
 * ADMIN MESSAGING — a private channel between the Super Admin (platform) and a
 * single tenant admin (coaching-center owner). One conversation per tenant. This
 * is platform-level data (spans the super↔tenant relationship), so it is NOT
 * tenant-scoped via `forTenant`: the super sees every conversation, while an
 * admin is confined to `tenantId === their own tenant` (derived from the session,
 * never from client input).
 */
export type MessageSenderRole = "superadmin" | "admin";

export type ConversationDoc = {
  _id: ObjectId;
  tenantId: string; // the tenant admin on the other side of the channel
  lastMessageAt: Date | null;
  lastMessagePreview: string;
  lastSenderRole: MessageSenderRole | null;
  adminUnread: number; // messages the tenant admin hasn't read (sent by super)
  superUnread: number; // messages the super hasn't read (sent by that admin)
  createdAt: Date;
};

export type MessageDoc = {
  _id: ObjectId;
  tenantId: string; // scopes an admin to their own conversation
  conversationId: string; // conversation _id (hex)
  senderRole: MessageSenderRole;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: Date;
  readByAdmin: boolean;
  readBySuper: boolean;
  deleted: boolean; // soft delete (Super Admin only)
  deletedAt: Date | null;
  deletedBy: string | null;
};

/**
 * Append-only audit trail for sensitive platform actions (e.g. "Clean Center
 * Data"). Records WHO did WHAT to WHICH center and the outcome. Never mutated.
 */
export type AuditLogDoc = {
  _id: ObjectId;
  action: string; // e.g. "clean_center_data"
  actorId: string; // super-admin user _id
  actorName: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  status: "success" | "failed";
  details?: Record<string, unknown>; // deleted counts, or the error message
  createdAt: Date;
};

/* ─────────────────────────── RESULTS MODULE ───────────────────────────
 * Exam results: subjects (master data per class), exams, per-student marks,
 * and a single tenant-level settings doc (grading scale / defaults). Every
 * derived figure — total, percentage, grade, pass/fail — is computed on READ
 * from these + the settings (see `lib/results/grade.ts`); nothing derived is
 * stored, so editing a mark or a grading band recalculates instantly. All are
 * tenant-scoped via `forTenant`, exactly like the finance collections.
 */

/** A subject offered in a class (e.g. "Bangla", "Mathematics"). Master data. */
export type SubjectDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  name: string;
  order: number;
};

export type ExamStatus = "draft" | "published";

/**
 * One exam for a class. `totalMarks` / `passMarks` are per-subject (each subject
 * is marked out of `totalMarks` and passes at `passMarks`), defaulted from
 * settings at creation. `subjectIds` are the subjects included, in display order.
 * Publishing is one-way (draft → published) and triggers guardian notifications.
 */
export type ExamDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  name: string;
  examType: string; // free label chosen from settings presets (e.g. "Model Test")
  date: string; // YYYY-MM-DD
  totalMarks: number; // per subject
  passMarks: number; // per subject
  subjectIds: string[];
  status: ExamStatus;
  createdAt: Date;
  publishedAt: Date | null;
};

/** A single subject's obtained mark for a student in an exam. */
export type MarkEntry = { subjectId: string; obtained: number | null }; // null = not entered / absent

/**
 * All of one student's marks for one exam, in a single document (mirrors
 * PaymentDoc's per-student-per-month shape). Upsert target: {tenantId, examId,
 * studentId}. Bulk mark entry writes the whole class in one `bulkWrite`.
 */
export type MarkDoc = {
  _id: ObjectId;
  tenantId: string;
  examId: string;
  studentId: string;
  classId: string;
  entries: MarkEntry[];
  updatedAt: Date;
};

/** One grading band: the minimum percentage that earns `grade` + its points. */
export type GradeBand = { grade: string; minPct: number; point: number };

export type PassRule = "per_subject" | "overall";

/**
 * Single per-tenant Results settings document (`scope: "exam"`), reused as the
 * source of defaults across Exam Setup, Results and Certificates. Mirrors the
 * `themeSettings` single-doc pattern but tenant-scoped.
 */
export type ExamSettingsDoc = {
  _id: ObjectId;
  tenantId: string;
  scope: "exam";
  gradingScale: GradeBand[]; // highest band first; last band is the fail grade
  passRule: PassRule; // per_subject = pass every subject; overall = aggregate %
  defaultTotalMarks: number;
  defaultPassMarks: number;
  examTypes: string[]; // preset exam-type labels for the Exam Setup dropdown
  certificateTitle: string; // heading printed on certificates
  notifyOnPublish: boolean; // send guardians an SMS when results are published
  updatedAt: Date;
};
