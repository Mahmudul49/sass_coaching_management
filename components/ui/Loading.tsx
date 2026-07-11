import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";

/**
 * Skeleton placeholders for loading states. Shapes mirror the real content
 * (KPI row, table rows) so the transition to loaded data is calm, not jarring.
 * MUI's Skeleton `wave` animation supplies the shimmer.
 */

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box>
      <Skeleton animation="wave" variant="rounded" height={44} sx={{ borderRadius: 2, mb: 1.25 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          animation="wave"
          variant="rounded"
          height={52}
          sx={{ borderRadius: 2, mb: 1, opacity: 1 - i * 0.06 }}
        />
      ))}
    </Box>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: `repeat(${count}, 1fr)` },
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} animation="wave" variant="rounded" height={130} sx={{ borderRadius: 4 }} />
      ))}
    </Box>
  );
}

export function PageSkeleton() {
  return (
    <Stack spacing={2.5} sx={{ p: { xs: 0.5, sm: 1 } }}>
      <Skeleton animation="wave" variant="text" width={200} height={44} />
      <Skeleton animation="wave" variant="rounded" height={72} sx={{ borderRadius: 3 }} />
      <CardsSkeleton />
      <Skeleton animation="wave" variant="rounded" height={220} sx={{ borderRadius: 4 }} />
      <TableSkeleton />
    </Stack>
  );
}
