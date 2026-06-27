import { redirect } from "next/navigation";

/** Root entry — super-admin dashboard. */
export default function Home() {
  redirect("/superadmin");
}
