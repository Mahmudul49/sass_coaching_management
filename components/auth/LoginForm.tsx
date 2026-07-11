"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import SchoolIcon from "@mui/icons-material/School";
import { loginAction, type LoginState } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="large" fullWidth disabled={pending}>
      {pending ? "Please wait..." : "Login"}
    </Button>
  );
}

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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420, boxShadow: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3, textAlign: "center" }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "#fff",
                display: "grid",
                placeItems: "center",
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
              {state.error && <Alert severity="error">{state.error}</Alert>}
              <TextField
                name="phone"
                label="Phone number"
                type="tel"
                autoComplete="username"
                required
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
        </CardContent>
      </Card>
    </Box>
  );
}
