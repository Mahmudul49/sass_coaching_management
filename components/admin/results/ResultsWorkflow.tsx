"use client";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

/**
 * Progress indicator shown across the exam workflow so admins always know where
 * they are: Create Exam → Enter Marks → Review → Publish. Purely presentational.
 */
const STEPS = ["Create Exam", "Enter Marks", "Review", "Publish"];

export default function ResultsWorkflow({ active }: { active: number }) {
  return (
    <Card>
      <CardContent sx={{ py: 2 }}>
        <Stepper activeStep={active} alternativeLabel>
          {STEPS.map((label, i) => (
            <Step key={label} completed={i < active}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </CardContent>
    </Card>
  );
}
