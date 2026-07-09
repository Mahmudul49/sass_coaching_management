"use client";
import { useRouter, usePathname } from "next/navigation";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useI18n } from "@/components/providers/I18nProvider";

/** Switch between the payment and attendance reports (server-driven via ?tab). */
export default function ReportTabs({ tab }: { tab: "payment" | "attendance" }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={tab}
      onChange={(_e, v) => v && router.push(`${pathname}?tab=${v}`)}
      sx={{ flexWrap: "wrap" }}
    >
      <ToggleButton value="payment">{t("tab_payment")}</ToggleButton>
      <ToggleButton value="attendance">{t("tab_attendance")}</ToggleButton>
    </ToggleButtonGroup>
  );
}
