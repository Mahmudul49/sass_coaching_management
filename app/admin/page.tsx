import { redirect } from "next/navigation";

/** Legacy /admin/* — redirect to super-admin login. */
export default function LegacyAdminPage() {
  redirect("/login");
}
