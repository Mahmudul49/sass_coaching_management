import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginForm from "@/components/auth/LoginForm";

/** Super-admin login only (tenant login lives at /{tenant}/login). */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role === "superadmin") redirect("/superadmin");

  return (
    <LoginForm
      slug=""
      title="কোচিং ম্যানেজমেন্ট"
      subtitle="সুপার অ্যাডমিন লগইন"
    />
  );
}
