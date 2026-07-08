"use client";
import { useRouter, usePathname } from "next/navigation";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

/** Switch between the payment and attendance reports (server-driven via ?tab). */
export default function ReportTabs({ tab }: { tab: "payment" | "attendance" }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={tab}
      onChange={(_e, v) => v && router.push(`${pathname}?tab=${v}`)}
      sx={{ flexWrap: "wrap" }}
    >
      <ToggleButton value="payment">পেমেন্ট রিপোর্ট</ToggleButton>
      <ToggleButton value="attendance">উপস্থিতি রিপোর্ট</ToggleButton>
    </ToggleButtonGroup>
  );
}
