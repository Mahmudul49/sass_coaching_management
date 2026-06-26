import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

/** Skeleton placeholders for loading states (design principle #6). */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box>
      <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1, mb: 1 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1, mb: 0.75 }} />
      ))}
    </Box>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={110} sx={{ flex: 1, borderRadius: 3 }} />
      ))}
    </Stack>
  );
}

export function PageSkeleton() {
  return (
    <Box sx={{ p: 1 }}>
      <Skeleton variant="text" width={220} height={40} sx={{ mb: 2 }} />
      <CardsSkeleton />
      <Box sx={{ mt: 3 }}>
        <TableSkeleton />
      </Box>
    </Box>
  );
}
