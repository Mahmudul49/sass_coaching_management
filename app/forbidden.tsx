import NextLink from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

// Rendered (HTTP 403) when forbidden() is called — e.g. an admin hitting another
// tenant's area, or a non-superadmin hitting /superadmin.
export default function Forbidden() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: 3,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ textAlign: "center", maxWidth: 420 }}>
        <Box
          sx={{
            width: 84,
            height: 84,
            mx: "auto",
            mb: 2.5,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: "warning.main",
            bgcolor: "#D9770618",
            boxShadow: "0 0 0 10px #D977070d",
            "& svg": { fontSize: 40 },
          }}
        >
          <LockOutlinedIcon fontSize="inherit" />
        </Box>
        <Typography
          sx={{
            fontFamily: "var(--font-display), var(--font-bengali), sans-serif",
            fontWeight: 800,
            fontSize: "3rem",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            mb: 1,
          }}
        >
          ৪০৩
        </Typography>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          প্রবেশাধিকার নেই / Access denied
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          এই পেজে আপনার প্রবেশের অনুমতি নেই। / You don&apos;t have permission to view this page.
        </Typography>
        <Button component={NextLink} href="/login" size="large">
          লগইন পেজে যান / Go to login
        </Button>
      </Box>
    </Box>
  );
}
