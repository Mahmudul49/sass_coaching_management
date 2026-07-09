"use client";
import Button from "@mui/material/Button";
import TranslateIcon from "@mui/icons-material/Translate";
import { useI18n } from "@/components/providers/I18nProvider";

/** AppBar language switch: shows the OTHER language you can switch to. */
export default function LanguageToggle() {
  const { locale, toggle } = useI18n();
  return (
    <Button
      color="inherit"
      size="small"
      startIcon={<TranslateIcon />}
      onClick={toggle}
      sx={{ minWidth: 0, mr: 0.5 }}
      aria-label="language"
    >
      {locale === "bn" ? "EN" : "বাং"}
    </Button>
  );
}
