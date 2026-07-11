import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isConsoleRole } from "@/lib/auth/permissions";
import LoginForm from "@/components/auth/LoginForm";

/** Central-console login for SuperAdmin + Admin (tenant login lives at /{tenant}/login). */
export default async function LoginPage() {
  const session = await auth();
  if (isConsoleRole(session?.user?.role)) redirect("/superadmin");

  return (
    <LoginForm
      slug=""
      title="Coaching Manager"
      subtitle="Admin Console Login"
    />
  );
}
