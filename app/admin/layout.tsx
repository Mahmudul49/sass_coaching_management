import { redirect } from "next/navigation";

export default function LegacyAdminLayout() {
  redirect("/login");
}
