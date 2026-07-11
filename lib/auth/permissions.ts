import type { Role } from "@/lib/db/collections";

/**
 * Centralized RBAC — the single source of truth for what each role may do in
 * the central back-office console. Guards (`lib/auth/guards.ts`), page layouts,
 * nav menus, and server actions all derive their decisions from `can()` so
 * authorization logic lives in exactly one place.
 */

export type Permission =
  | "console:view" // see the console shell + dashboard
  | "centers:read" // view the coaching-center (tenant) list
  | "centers:manage" // create / edit / activate-deactivate centers
  | "students:read" // cross-center marketing student search
  | "users:read" // view platform users
  | "users:manage" // create / edit / delete / reset / (de)activate platform users
  | "theme:manage"; // open + save the Theme Builder

const ALL: Permission[] = [
  "console:view",
  "centers:read",
  "centers:manage",
  "students:read",
  "users:read",
  "users:manage",
  "theme:manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: ALL,
  // Restricted platform staff: read-only console access.
  platform_admin: ["console:view", "centers:read", "students:read"],
  // Tenant admins never operate the central console.
  admin: [],
};

/** True when `role` is granted `perm`. */
export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

/** Roles allowed to enter the central console at all. */
export function isConsoleRole(role: Role | undefined | null): boolean {
  return role === "superadmin" || role === "platform_admin";
}
