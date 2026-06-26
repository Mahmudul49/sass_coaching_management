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
  students: "students",
  attendance: "attendance",
  payments: "payments",
  smsLog: "smsLog",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];

export type Role = "superadmin" | "admin";

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
  tenantId: string | null; // null only for the superadmin
  name: string;
  phone: string;
  passwordHash: string;
  role: Role;
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

export type FeeComponent = { label: string; amount: number };

export type FeeStructureDoc = {
  _id: ObjectId;
  tenantId: string;
  classId: string;
  admissionFee: number;
  monthlyFee: number;
  modelTestHalfYearly: { amount: number; month: number }; // month 1-12
  modelTestAnnual: { amount: number; month: number };
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
};

export type SmsKind =
  | "attendance_present"
  | "attendance_absent"
  | "payment_received"
  | "payment_due";

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
