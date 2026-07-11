"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { tenantAdminPath } from "@/lib/tenant/paths";

export type LoginState = { error?: string };

/**
 * Login server action. The hidden `slug` field tells us whether this is a
 * tenant-admin login (non-empty slug -> /{slug}/admin) or the super-admin
 * login on the root domain (empty slug -> /superadmin).
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!phone || !password) {
    return { error: "Enter phone number and password." };
  }

  const redirectTo = slug ? tenantAdminPath(slug) : "/superadmin";

  try {
    await signIn("credentials", { phone, password, slug, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Phone number or password is incorrect." };
    }
    throw error;
  }
  return {};
}
