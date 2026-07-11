import NextLink from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";

// Shown for unknown tenant addresses and any unmatched route.
export default function NotFound() {
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
      <Box sx={{ textAlign: "center", maxWidth: 440 }}>
        <Box
          sx={{
            width: 84,
            height: 84,
            mx: "auto",
            mb: 2.5,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            bgcolor: "#0F7A6B14",
            boxShadow: "0 0 0 10px #0F7A6B0a",
            "& svg": { fontSize: 40 },
          }}
        >
          <TravelExploreIcon fontSize="inherit" />
        </Box>
        <Typography
          sx={{
            fontFamily: "var(--font-display), var(--font-bengali), sans-serif",
            fontWeight: 800,
            fontSize: "3.4rem",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            mb: 1,
          }}
        >
          ৪০৪
        </Typography>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          পেজ খুঁজে পাওয়া যায়নি / Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          পেজটি খুঁজে পাওয়া যায়নি অথবা এই ঠিকানায় কোনো সেন্টার নেই। / This page doesn&apos;t exist, or
          no center lives at this address.
        </Typography>
        <Button component={NextLink} href="/login" size="large">
          লগইন পেজে যান / Go to login
        </Button>
      </Box>
    </Box>
  );
}
