"use server";
import { requireAdminFromRequest } from "@/lib/auth/guards";
import {
  Collections,
  type ClassDoc,
  type SectionDoc,
} from "@/lib/db/collections";
import { toObjectId } from "@/lib/db/oid";
import { revalidateTenantAdminLayout } from "@/lib/tenant/revalidate";

export type ActionResult = { ok: boolean; error?: string };
export type StudentInput = {
  classId: string;
  sectionId: string;
  name: string;
  roll: string;
  phone: string;
};

const fail = (error: string): ActionResult => ({ ok: false, error });

async function validateClassSection(
  db: Awaited<ReturnType<typeof requireAdminFromRequest>>["db"],
  classId: string,
  sectionId: string
): Promise<string | null> {
  if (!classId) return "ক্লাস নির্বাচন করুন।";
  if (!sectionId) return "শাখা নির্বাচন করুন।";
  const section = (await db
    .collection<SectionDoc>(Collections.sections)
    .findOne({ _id: toObjectId(sectionId)! } as never)) as SectionDoc | null;
  if (!section) return "শাখা পাওয়া যায়নি।";
  if (section.classId !== classId) return "শাখাটি এই ক্লাসের নয়।";
  return null;
}

export async function createStudent(input: StudentInput): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const name = input.name?.trim();
  const roll = input.roll?.trim();
  const phone = input.phone?.trim();
  if (!name) return fail("নাম দিন।");
  if (!roll) return fail("রোল দিন।");
  if (!phone) return fail("ফোন নম্বর দিন।");
  const err = await validateClassSection(db, input.classId, input.sectionId);
  if (err) return fail(err);

  await db.collection(Collections.students).insertOne({
    classId: input.classId,
    sectionId: input.sectionId,
    name,
    roll,
    phone,
    active: true,
    createdAt: new Date(),
  } as never);
  await revalidateTenantAdminLayout();
  return { ok: true };
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  const name = input.name?.trim();
  const roll = input.roll?.trim();
  const phone = input.phone?.trim();
  if (!name) return fail("নাম দিন।");
  if (!roll) return fail("রোল দিন।");
  if (!phone) return fail("ফোন নম্বর দিন।");
  const err = await validateClassSection(db, input.classId, input.sectionId);
  if (err) return fail(err);

  await db.collection(Collections.students).updateOne({ _id } as never, {
    $set: {
      classId: input.classId,
      sectionId: input.sectionId,
      name,
      roll,
      phone,
    },
  });
  await revalidateTenantAdminLayout();
  return { ok: true };
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  const { db } = await requireAdminFromRequest();
  const _id = toObjectId(id);
  if (!_id) return fail("ভুল আইডি।");
  await db.collection(Collections.students).deleteOne({ _id } as never);
  await revalidateTenantAdminLayout();
  return { ok: true };
}

/**
 * Bulk import by NAMES. The Excel references classes/sections by name; any class
 * or section that doesn't exist yet is created automatically so non-technical
 * admins don't have to pre-build master data with exact names. Rows missing a
 * required field are skipped.
 */
export type ExcelStudentRow = {
  name: string;
  roll: string;
  phone: string;
  className: string;
  sectionName: string;
};
export type ImportResult = {
  ok: boolean;
  inserted: number;
  classesCreated: number;
  sectionsCreated: number;
  error?: string;
};

export async function importStudentsFromExcel(
  rows: ExcelStudentRow[]
): Promise<ImportResult> {
  const { db } = await requireAdminFromRequest();
  const empty = { inserted: 0, classesCreated: 0, sectionsCreated: 0 };
  if (!rows?.length) return { ok: false, ...empty, error: "কোনো সারি নেই।" };

  // Existing classes/sections, keyed case-insensitively by name.
  const classes = (await db
    .collection<ClassDoc>(Collections.classes)
    .findArray({})) as ClassDoc[];
  const classByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c._id.toString()]));
  let order = classes.length;
  let classesCreated = 0;

  const ensureClass = async (name: string): Promise<string> => {
    const key = name.trim().toLowerCase();
    const existing = classByName.get(key);
    if (existing) return existing;
    const res = await db
      .collection(Collections.classes)
      .insertOne({ name: name.trim(), order: order++ } as never);
    const id = res.insertedId.toString();
    classByName.set(key, id);
    classesCreated++;
    return id;
  };

  const sections = (await db
    .collection<SectionDoc>(Collections.sections)
    .findArray({})) as SectionDoc[];
  const secKey = (classId: string, name: string) => `${classId}::${name.trim().toLowerCase()}`;
  const sectionByKey = new Map(sections.map((s) => [secKey(s.classId, s.name), s._id.toString()]));
  let sectionsCreated = 0;

  const ensureSection = async (classId: string, name: string): Promise<string> => {
    const key = secKey(classId, name);
    const existing = sectionByKey.get(key);
    if (existing) return existing;
    const res = await db
      .collection(Collections.sections)
      .insertOne({ classId, name: name.trim() } as never);
    const id = res.insertedId.toString();
    sectionByKey.set(key, id);
    sectionsCreated++;
    return id;
  };

  const now = new Date();
  const docs: Record<string, unknown>[] = [];
  for (const r of rows) {
    const name = r.name?.trim();
    const roll = r.roll?.trim();
    const phone = r.phone?.trim();
    const className = r.className?.trim();
    const sectionName = r.sectionName?.trim();
    if (!name || !roll || !phone || !className || !sectionName) continue;

    const classId = await ensureClass(className);
    const sectionId = await ensureSection(classId, sectionName);
    docs.push({ classId, sectionId, name, roll, phone, active: true, createdAt: now });
  }

  if (!docs.length)
    return { ok: false, classesCreated, sectionsCreated, inserted: 0, error: "কোনো বৈধ সারি নেই।" };

  const res = await db.collection(Collections.students).insertMany(docs as never[]);
  await revalidateTenantAdminLayout();
  return { ok: true, inserted: res.insertedCount, classesCreated, sectionsCreated };
}
