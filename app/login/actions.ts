"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

/**
 * Login server action. The hidden `slug` field tells us whether this is a
 * tenant-admin login (non-empty slug -> /admin) or the super-admin login on the
 * root domain (empty slug -> /superadmin).
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!phone || !password) {
    return { error: "ফোন নম্বর ও পাসওয়ার্ড দিন।" };
  }

  const redirectTo = slug ? "/admin" : "/superadmin";

  try {
    await signIn("credentials", { phone, password, slug, redirectTo });
  } catch (error) {
    // signIn throws a NEXT_REDIRECT on success — that MUST be rethrown.
    if (error instanceof AuthError) {
      return { error: "ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।" };
    }
    throw error;
  }
  return {};
}
