"use client";
import NextLink from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EmptyState from "@/components/ui/EmptyState";
import type { ClassRow } from "@/lib/admin/queries";

/**
 * Scalable dashboard students summary. Renders per-class ACTIVE counts from the
 * lightweight `getActiveCountsByClass` aggregation (one grouped index scan) plus
 * a deep link into the paginated Students page — instead of loading every
 * student row onto the landing page. Presentational server component: no state,
 * no unbounded fetch, constant payload regardless of tenant size.
 */
export default function StudentsOverview({
  classes,
  activeCounts,
  totalActive,
  studentsPath,
}: {
  classes: ClassRow[];
  activeCounts: Record<string, number>;
  totalActive: number;
  studentsPath: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1.5}
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                color: "#0F7A6B",
                bgcolor: "rgba(15,122,107,0.12)",
                border: "1px solid rgba(15,122,107,0.22)",
              }}
            >
              <GroupsIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" lineHeight={1.1}>
                Students
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {totalActive.toLocaleString("en-US")} active across {classes.length} classes
              </Typography>
            </Box>
          </Stack>
          <Button
            component={NextLink}
            href={studentsPath}
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon />}
            sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
          >
            View all students
          </Button>
        </Stack>

        {classes.length === 0 ? (
          <EmptyState title="No classes yet" description="Add classes to see student counts." />
        ) : (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {classes.map((c) => (
              <Chip
                key={c.id}
                component={NextLink}
                href={`${studentsPath}?classId=${encodeURIComponent(c.id)}`}
                clickable
                variant="outlined"
                label={`${c.name}: ${(activeCounts[c.id] ?? 0).toLocaleString("en-US")}`}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
