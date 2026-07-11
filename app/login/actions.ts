"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { tenantAdminPath } from "@/lib/tenant/paths";
import { checkRateLimit, loginKey } from "@/lib/auth/rateLimit";

export type LoginState = { error?: string };

function lockedMessage(retryAfterSec: number): string {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many failed attempts. For your security, please try again in about ${mins} minute${
    mins > 1 ? "s" : ""
  }.`;
}

/**
 * Login server action. The hidden `slug` field tells us whether this is a
 * tenant-admin login (non-empty slug -> /{slug}/admin) or the super-admin
 * login on the root domain (empty slug -> /superadmin).
 *
 * Brute-force protection lives in `authorize` (so it can't be bypassed); here we
 * only READ the counter to give the user a friendly, specific message — an early
 * "locked, try again in N min", or a "N attempts left" heads-up before the lock.
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

  const key = loginKey(slug, phone);

  // Already locked? Tell them how long to wait instead of spending a login try.
  const pre = await checkRateLimit(key);
  if (pre.blocked) return { error: lockedMessage(pre.retryAfterSec) };

  const redirectTo = slug ? tenantAdminPath(slug) : "/superadmin";

  try {
    await signIn("credentials", { phone, password, slug, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      // `authorize` has recorded this failure — re-read to warn the user before
      // the lock, or show the lock message if that attempt just tripped it.
      const post = await checkRateLimit(key);
      if (post.blocked) return { error: lockedMessage(post.retryAfterSec) };
      if (post.remaining <= 2) {
        return {
          error: `Phone number or password is incorrect. ${post.remaining} attempt${
            post.remaining === 1 ? "" : "s"
          } left before a temporary lock.`,
        };
      }
      return { error: "Phone number or password is incorrect." };
    }
    throw error; // success redirect (NEXT_REDIRECT) or a real error — let it bubble
  }
  return {};
}
