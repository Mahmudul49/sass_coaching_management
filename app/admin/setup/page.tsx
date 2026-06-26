import { requireAdmin } from "@/lib/auth/guards";
import {
  listClasses,
  listSections,
  listFees,
  listStudents,
  getSetupStatus,
} from "@/lib/admin/queries";
import SetupWizard from "@/components/admin/SetupWizard";

export default async function SetupPage() {
  const { db } = await requireAdmin();
  const [classes, sections, fees, students, status] = await Promise.all([
    listClasses(db),
    listSections(db),
    listFees(db),
    listStudents(db),
    getSetupStatus(db),
  ]);
  return (
    <SetupWizard
      classes={classes}
      sections={sections}
      fees={fees}
      students={students}
      status={status}
    />
  );
}
