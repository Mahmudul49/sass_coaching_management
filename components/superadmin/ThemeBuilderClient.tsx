"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import { ThemeProvider } from "@mui/material/styles";
import type { ThemePalette } from "@/lib/db/collections";
import {
  DEFAULT_CONSOLE_THEME,
  THEME_TOKENS,
  buildConsoleTheme,
  type ThemeMode,
} from "@/lib/theme/console";
import type { ConsoleTheme } from "@/lib/superadmin/theme";
import { useToast } from "@/components/providers/ToastProvider";
import { saveThemeAction } from "@/app/superadmin/theme/actions";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function ThemeBuilderClient({ initial }: { initial: ConsoleTheme }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<ThemeMode>("light");
  const [light, setLight] = useState<ThemePalette>(initial.light);
  const [dark, setDark] = useState<ThemePalette>(initial.dark);

  const palette = mode === "dark" ? dark : light;
  const setPalette = mode === "dark" ? setDark : setLight;
  const previewTheme = useMemo(() => buildConsoleTheme(palette, mode), [palette, mode]);

  const setToken = (key: keyof ThemePalette, value: string) =>
    setPalette((p) => ({ ...p, [key]: value }));

  function resetMode() {
    setPalette({ ...DEFAULT_CONSOLE_THEME[mode] });
    toast.info(`${mode === "dark" ? "Dark" : "Light"} palette reset to default.`);
  }

  function save() {
    start(async () => {
      const res = await saveThemeAction({ light, dark });
      if (res.ok) {
        toast.success("Theme saved.");
        router.refresh(); // pull the revalidated layout so the console restyles
      } else toast.error(res.error ?? "Could not save the theme.");
    });
  }

  return (
    <Stack spacing={2.5}>
      <Tabs value={mode} onChange={(_, v) => setMode(v as ThemeMode)}>
        <Tab value="light" label="Light mode" />
        <Tab value="dark" label="Dark mode" />
      </Tabs>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="flex-start">
        {/* Token editor */}
        <Card sx={{ flex: 1, width: "100%" }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
              Colors — {mode === "dark" ? "Dark" : "Light"}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {THEME_TOKENS.map((tok) => {
                const value = palette[tok.key];
                const valid = HEX_RE.test(value);
                return (
                  <Stack key={tok.key} direction="row" spacing={1} alignItems="center">
                    <Box
                      component="input"
                      type="color"
                      value={valid ? value : "#000000"}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setToken(tok.key, e.target.value)
                      }
                      sx={{
                        width: 42,
                        height: 42,
                        p: 0,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      aria-label={`${tok.label} color`}
                    />
                    <TextField
                      label={tok.label}
                      value={value}
                      onChange={(e) => setToken(tok.key, e.target.value)}
                      error={!valid}
                      helperText={valid ? tok.hint : "Use a 6-digit hex, e.g. #1A2B3C"}
                      size="small"
                    />
                  </Stack>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Live preview (uses the edited palette immediately) */}
        <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0, position: { md: "sticky" }, top: { md: 88 } }}>
          <ThemeProvider theme={previewTheme}>
            <Box
              sx={{
                bgcolor: "background.default",
                color: "text.primary",
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <Box sx={{ bgcolor: palette.navbar, color: "#fff", px: 2, py: 1.5 }}>
                <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 700 }}>
                  Preview
                </Typography>
              </Box>
              <Stack direction="row" sx={{ minHeight: 220 }}>
                <Box sx={{ bgcolor: palette.sidebar, color: "#fff", width: 96, p: 1.5 }}>
                  <Stack spacing={1}>
                    <Box sx={{ bgcolor: "rgba(255,255,255,0.18)", borderRadius: 1, height: 10 }} />
                    <Box sx={{ bgcolor: "rgba(255,255,255,0.10)", borderRadius: 1, height: 10 }} />
                    <Box sx={{ bgcolor: "rgba(255,255,255,0.10)", borderRadius: 1, height: 10 }} />
                  </Stack>
                </Box>
                <Box sx={{ flex: 1, p: 1.5 }}>
                  <Card sx={{ mb: 1.5 }}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="body2" color="text.secondary">
                        Total centers
                      </Typography>
                      <Typography variant="h6">128</Typography>
                    </CardContent>
                  </Card>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                    <Chip label="Active" color="success" size="small" />
                    <Chip label="Info" color="info" size="small" />
                    <Chip label="Due" color="error" size="small" />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" sx={{ bgcolor: palette.button }}>
                      Primary
                    </Button>
                    <Button size="small" variant="outlined" color="secondary">
                      Cancel
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </ThemeProvider>
        </Box>
      </Stack>

      <Divider />
      <Alert severity="info" variant="outlined">
        Saved changes apply instantly to the whole admin console (both light and dark). Coaching
        center apps keep their own branding.
      </Alert>
      <Stack direction="row" spacing={1.5} justifyContent="flex-end">
        <Button
          variant="text"
          color="inherit"
          startIcon={<RestartAltIcon />}
          onClick={resetMode}
          disabled={pending}
        >
          Reset {mode} to default
        </Button>
        <Button startIcon={<SaveIcon />} onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save theme"}
        </Button>
      </Stack>
    </Stack>
  );
}
