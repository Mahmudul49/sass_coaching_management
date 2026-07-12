"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import SchoolIcon from "@mui/icons-material/School";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { alpha } from "@mui/material/styles";
import { loginAction, type LoginState } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="large" fullWidth disabled={pending}>
      {pending ? "Please wait..." : "Login"}
    </Button>
  );
}

const HIGHLIGHTS = [
  { icon: <BoltOutlinedIcon />, text: "Attendance, fees & receipts in one place" },
  { icon: <InsightsOutlinedIcon />, text: "Live collection & due insights" },
  { icon: <ShieldOutlinedIcon />, text: "Secure, private per-center data" },
];

export default function LoginForm({
  slug,
  title,
  subtitle,
}: {
  slug: string;
  title: string;
  subtitle: string;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
      }}
    >
      {/* Brand panel — desktop only */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          color: "#fff",
          backgroundImage:
            "linear-gradient(155deg, #0A5A4E 0%, #0F7A6B 55%, #0C6656 100%)",
        }}
      >
        {/* Atmospheric mesh + grain */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(600px 400px at 85% 10%, rgba(228,137,11,0.28), transparent 60%), radial-gradient(700px 500px at 10% 90%, rgba(63,165,149,0.4), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(circle at 50% 40%, #000, transparent 75%)",
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                bgcolor: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              <SchoolIcon />
            </Box>
            <Typography sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
              EduPilot
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ position: "relative", maxWidth: 460 }}>
          <Typography
            sx={{
              fontFamily: "var(--font-display), var(--font-bengali), sans-serif",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              fontSize: "2.6rem",
              mb: 2,
            }}
          >
            Smart School &amp; Coaching Management Software.
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 3 }}>
            {HIGHLIGHTS.map((h) => (
              <Stack key={h.text} direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(255,255,255,0.12)",
                    "& svg": { fontSize: 20 },
                  }}
                >
                  {h.icon}
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.92 }}>
                  {h.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ position: "relative", opacity: 0.7 }}>
          © {new Date().getFullYear()} EduPilot
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2.5, sm: 4 },
          bgcolor: "background.default",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 400,
            animation: "loginRise .45s cubic-bezier(.22,1,.36,1) both",
            "@keyframes loginRise": {
              from: { opacity: 0, transform: "translateY(10px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Stack spacing={1} alignItems="center" sx={{ mb: 3.5, textAlign: "center" }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                mb: 0.5,
                color: "primary.main",
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.22)}`,
              }}
            >
              <SchoolIcon />
            </Box>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Stack>

          <form action={formAction}>
            <input type="hidden" name="slug" value={slug} />
            <Stack spacing={2}>
              {state.error && (
                <Alert severity="error" sx={{ animation: "loginRise .25s ease both" }}>
                  {state.error}
                </Alert>
              )}
              <TextField
                name="phone"
                label="Phone number"
                type="tel"
                autoComplete="username"
                required
                autoFocus
                inputProps={{ inputMode: "tel" }}
              />
              <TextField
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                required
              />
              <SubmitButton />
            </Stack>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
