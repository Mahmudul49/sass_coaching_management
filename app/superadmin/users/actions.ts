"use server";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/connect";
import { Collections, type Role, type UserDoc } from "@/lib/db/collections";
import { hashPassword } from "@/lib/auth/password";
import { requireSuperAdmin } from "@/lib/auth/guards";

export type ActionResult = { ok: boolean; error?: string };

type ConsoleRole = Extract<Role, "superadmin" | "platform_admin">;

function normRole(r: unknown): ConsoleRole | null {
  return r === "superadmin" || r === "platform_admin" ? r : null;
}

function parseId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/** Count active superadmins — used to protect the last one. */
async function activeSuperadminCount(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  return db
    .collection<UserDoc>(Collections.users)
    .countDocuments({ tenantId: null, role: "superadmin", active: { $ne: false } });
}

/** Create a platform user (superadmin or platform_admin). SuperAdmin only. */
export async function createUser(input: {
  name: string;
  phone: string;
  password: string;
  role: ConsoleRole;
}): Promise<ActionResult> {
  await requireSuperAdmin();

  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const password = input.password ?? "";
  const role = normRole(input.role);

  if (!name) return { ok: false, error: "Enter a name." };
  if (!phone) return { ok: false, error: "Enter a phone number." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (!role) return { ok: false, error: "Choose a valid role." };

  const db = await getDb();

  const clash = await db
    .collection<UserDoc>(Collections.users)
    .findOne({ tenantId: null, phone });
  if (clash) return { ok: false, error: "A console user with this phone already exists." };

  const passwordHash = await hashPassword(password);
  try {
    await db.collection(Collections.users).insertOne({
      tenantId: null,
      name,
      phone,
      passwordHash,
      role,
      active: true,
    });
  } catch {
    return { ok: false, error: "Could not create the user — please re-check the phone number." };
  }

  revalidatePath("/superadmin/users");
  return { ok: true };
}

/** Edit a platform user's name, phone, and role. SuperAdmin only. */
export async function updateUser(
  userId: string,
  input: { name: string; phone: string; role: ConsoleRole }
): Promise<ActionResult> {
  const { userId: selfId } = await requireSuperAdmin();

  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const role = normRole(input.role);
  if (!name) return { ok: false, error: "Enter a name." };
  if (!phone) return { ok: false, error: "Enter a phone number." };
  if (!role) return { ok: false, error: "Choose a valid role." };

  const _id = parseId(userId);
  if (!_id) return { ok: false, error: "Invalid ID." };

  const db = await getDb();
  const user = await db.collection<UserDoc>(Collections.users).findOne({ _id, tenantId: null });
  if (!user) return { ok: false, error: "User not found." };

  // Don't allow demoting yourself or the last superadmin out of the role.
  if (user.role === "superadmin" && role !== "superadmin") {
    if (userId === selfId) return { ok: false, error: "You cannot change your own role." };
    if ((await activeSuperadminCount(db)) <= 1) {
      return { ok: false, error: "At least one active SuperAdmin is required." };
    }
  }

  // Phone must stay unique among console users.
  if (phone !== user.phone) {
    const clash = await db
      .collection<UserDoc>(Collections.users)
      .findOne({ tenantId: null, phone });
    if (clash) return { ok: false, error: "A console user with this phone already exists." };
  }

  await db
    .collection(Collections.users)
    .updateOne({ _id }, { $set: { name, phone, role } });

  revalidatePath("/superadmin/users");
  return { ok: true };
}

/** Reset a platform user's password. SuperAdmin only. */
export async function resetUserPassword(
  userId: string,
  password: string
): Promise<ActionResult> {
  await requireSuperAdmin();
  if ((password ?? "").length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const _id = parseId(userId);
  if (!_id) return { ok: false, error: "Invalid ID." };

  const db = await getDb();
  const user = await db.collection<UserDoc>(Collections.users).findOne({ _id, tenantId: null });
  if (!user) return { ok: false, error: "User not found." };

  const passwordHash = await hashPassword(password);
  await db.collection(Collections.users).updateOne({ _id }, { $set: { passwordHash } });
  revalidatePath("/superadmin/users");
  return { ok: true };
}

/** Activate / deactivate a platform user. SuperAdmin only. */
export async function setUserActive(
  userId: string,
  active: boolean
): Promise<ActionResult> {
  const { userId: selfId } = await requireSuperAdmin();
  const _id = parseId(userId);
  if (!_id) return { ok: false, error: "Invalid ID." };
  if (userId === selfId && !active) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  const db = await getDb();
  const user = await db.collection<UserDoc>(Collections.users).findOne({ _id, tenantId: null });
  if (!user) return { ok: false, error: "User not found." };

  if (!active && user.role === "superadmin" && (await activeSuperadminCount(db)) <= 1) {
    return { ok: false, error: "At least one active SuperAdmin is required." };
  }

  await db.collection(Collections.users).updateOne({ _id }, { $set: { active } });
  revalidatePath("/superadmin/users");
  return { ok: true };
}

/** Delete a platform user. SuperAdmin only. */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const { userId: selfId } = await requireSuperAdmin();
  const _id = parseId(userId);
  if (!_id) return { ok: false, error: "Invalid ID." };
  if (userId === selfId) return { ok: false, error: "You cannot delete your own account." };

  const db = await getDb();
  const user = await db.collection<UserDoc>(Collections.users).findOne({ _id, tenantId: null });
  if (!user) return { ok: false, error: "User not found." };

  if (user.role === "superadmin" && (await activeSuperadminCount(db)) <= 1) {
    return { ok: false, error: "At least one active SuperAdmin is required." };
  }

  await db.collection(Collections.users).deleteOne({ _id });
  revalidatePath("/superadmin/users");
  return { ok: true };
}
