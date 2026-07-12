"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import ClassesManager from "./ClassesManager";
import SectionsManager from "./SectionsManager";
import FeesManager from "./FeesManager";
import StudentsManager from "./StudentsManager";
import type {
  ClassRow,
  SectionRow,
  FeeRow,
  StudentRow,
  SetupStatus,
} from "@/lib/admin/queries";
import { tenantAdminBaseFromPath } from "@/components/layout/tenantAdminBase";

const STEPS = ["Classes", "Sections", "Fee Structure", "Students"];

export default function SetupWizard({
  classes,
  sections,
  fees,
  students,
  status,
}: {
  classes: ClassRow[];
  sections: SectionRow[];
  fees: FeeRow[];
  students: StudentRow[];
  status: SetupStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const adminBase = tenantAdminBaseFromPath(pathname);
  const [active, setActive] = useState(0);

  const stepDone = [status.hasClasses, status.hasSections, status.hasFees, status.hasStudents];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">Welcome! Let&apos;s get set up</Typography>
        <Typography variant="body2" color="text.secondary">
          Prepare your coaching center in 4 easy steps.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stepper activeStep={active} alternativeLabel>
            {STEPS.map((label, i) => (
              <Step key={label} completed={stepDone[i]}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Box>
        {active === 0 && <ClassesManager classes={classes} />}
        {active === 1 && <SectionsManager classes={classes} sections={sections} />}
        {active === 2 && <FeesManager fees={fees} />}
        {active === 3 && (
          <StudentsManager students={students} classes={classes} sections={sections} />
        )}
      </Box>

      {active === 1 && !status.hasClasses && (
        <Alert severity="info">Add at least one class first.</Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between">
            <Button
              variant="outlined"
              color="inherit"
              disabled={active === 0}
              onClick={() => setActive((s) => s - 1)}
            >
              Previous
            </Button>
            {active < STEPS.length - 1 ? (
              <Stack direction="row" spacing={1}>
                <Button variant="text" color="inherit" onClick={() => router.push(adminBase)}>
                  I&apos;ll do it later
                </Button>
                <Button onClick={() => setActive((s) => s + 1)}>Next</Button>
              </Stack>
            ) : (
              <Button color="success" onClick={() => router.push(adminBase)}>
                Finish
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
