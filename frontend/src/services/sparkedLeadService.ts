import { Timestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  orderBy,
  where,
  toTimestamp,
} from "./firestore";
import type {
  SparkedCollege,
  SparkedDepartment,
  SparkedDeptFollowUp,
  SparkedDeptStatus,
  SparkedCollegeWithDepts,
  MouScope,
} from "@/types";
import { logLeadStatusChanged, logMouSigned } from "./activityLogService";

// ============================================
// Colleges
// ============================================

export interface FirestoreSparkedCollege {
  id: string;
  collegeName: string;
  address: string;
  mouScope: MouScope;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toCollege(doc: FirestoreSparkedCollege): SparkedCollege {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getCollegeById(id: string): Promise<SparkedCollege | null> {
  const college = await getDocument<FirestoreSparkedCollege>(COLLECTIONS.SPARKED_COLLEGES, id);
  if (!college) return null;
  return toCollege(college);
}

export async function getAllColleges(): Promise<SparkedCollege[]> {
  const colleges = await getDocuments<FirestoreSparkedCollege>(
    COLLECTIONS.SPARKED_COLLEGES,
    orderBy("createdAt", "desc")
  );
  return colleges.map(toCollege);
}

export async function createCollege(
  data: Omit<SparkedCollege, "id" | "mouScope" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument(COLLECTIONS.SPARKED_COLLEGES, {
    ...data,
    mouScope: "NONE" as MouScope,
  });
}

export async function updateCollege(
  id: string,
  data: Partial<Omit<SparkedCollege, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.SPARKED_COLLEGES, id, data);
}

// Deletes a college and cascades to its departments and their follow-ups —
// matches projectService.deleteProject's cascade pattern for phases/MVP features.
export async function deleteCollege(id: string): Promise<void> {
  const departments = await getDepartmentsByCollege(id);
  for (const dept of departments) {
    await deleteDepartment(dept.id);
  }
  await deleteDocument(COLLECTIONS.SPARKED_COLLEGES, id);
}

// ============================================
// Departments
// ============================================

export interface FirestoreSparkedDepartment {
  id: string;
  collegeId: string;
  deptName: string;
  contactName: string;
  contactNumber: string;
  contactEmail?: string;
  approachedByName: string;
  approachedByNumber: string;
  dateFirstSpoken: Timestamp;
  meetingDescription: string;
  rateDiscussed?: number;
  approxCount?: number;
  notes?: string;
  status: SparkedDeptStatus;
  dropReason?: string;
  mouSignedVia?: SparkedDepartment["mouSignedVia"];
  nextFollowUpDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toDepartment(doc: FirestoreSparkedDepartment): SparkedDepartment {
  return {
    ...doc,
    dateFirstSpoken: doc.dateFirstSpoken.toDate(),
    nextFollowUpDate: doc.nextFollowUpDate?.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getDepartmentById(id: string): Promise<SparkedDepartment | null> {
  const department = await getDocument<FirestoreSparkedDepartment>(
    COLLECTIONS.SPARKED_DEPARTMENTS,
    id
  );
  if (!department) return null;
  return toDepartment(department);
}

export async function getDepartmentsByCollege(collegeId: string): Promise<SparkedDepartment[]> {
  const departments = await getDocuments<FirestoreSparkedDepartment>(
    COLLECTIONS.SPARKED_DEPARTMENTS,
    where("collegeId", "==", collegeId)
  );
  return departments
    .map(toDepartment)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAllDepartments(): Promise<SparkedDepartment[]> {
  const departments = await getDocuments<FirestoreSparkedDepartment>(
    COLLECTIONS.SPARKED_DEPARTMENTS,
    orderBy("createdAt", "desc")
  );
  return departments.map(toDepartment);
}

export async function createDepartment(
  data: Omit<SparkedDepartment, "id" | "status" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument(COLLECTIONS.SPARKED_DEPARTMENTS, {
    ...data,
    dateFirstSpoken: toTimestamp(data.dateFirstSpoken),
    nextFollowUpDate: data.nextFollowUpDate ? toTimestamp(data.nextFollowUpDate) : undefined,
    status: "NEW" as SparkedDeptStatus,
  });
}

export async function updateDepartment(
  id: string,
  data: Partial<Omit<SparkedDepartment, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.dateFirstSpoken) updateData.dateFirstSpoken = toTimestamp(data.dateFirstSpoken);
  if (data.nextFollowUpDate) updateData.nextFollowUpDate = toTimestamp(data.nextFollowUpDate);
  await updateDocument(COLLECTIONS.SPARKED_DEPARTMENTS, id, updateData);
}

export async function changeDepartmentStatus(
  id: string,
  newStatus: SparkedDeptStatus,
  userId: string,
  dropReason?: string
): Promise<void> {
  const department = await getDepartmentById(id);
  if (!department) throw new Error("Department not found");

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "DROPPED") updateData.dropReason = dropReason || "";

  await updateDocument(COLLECTIONS.SPARKED_DEPARTMENTS, id, updateData);
  await logLeadStatusChanged(
    userId,
    id,
    `${department.deptName}`,
    department.status,
    newStatus
  );

  // Signing individually (not via the college-wide bulk action) means the
  // college's overall MOU scope is at most partial — recompute it.
  await recomputeCollegeMouScope(department.collegeId);
}

export async function deleteDepartment(id: string): Promise<void> {
  const followUps = await getDeptFollowUps(id);
  await Promise.all(
    followUps.map((f) => deleteDocument(COLLECTIONS.SPARKED_DEPT_FOLLOWUPS, f.id))
  );
  await deleteDocument(COLLECTIONS.SPARKED_DEPARTMENTS, id);
}

// ============================================
// Follow-ups
// ============================================

export interface FirestoreSparkedDeptFollowUp {
  id: string;
  deptId: string;
  date: Timestamp;
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Timestamp;
  loggedBy: string;
  createdAt: Timestamp;
}

function toFollowUp(doc: FirestoreSparkedDeptFollowUp): SparkedDeptFollowUp {
  return {
    ...doc,
    date: doc.date.toDate(),
    nextFollowUpDate: doc.nextFollowUpDate?.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

export async function getDeptFollowUps(deptId: string): Promise<SparkedDeptFollowUp[]> {
  const followUps = await getDocuments<FirestoreSparkedDeptFollowUp>(
    COLLECTIONS.SPARKED_DEPT_FOLLOWUPS,
    where("deptId", "==", deptId)
  );
  return followUps.map(toFollowUp).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export interface AddDeptFollowUpInput {
  deptId: string;
  meetingNotes: string;
  loggedBy: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
}

// Logs a follow-up and patches the department's live nextFollowUpDate /
// approxCount / rateDiscussed when the founder provides updated values.
export async function addDeptFollowUp(input: AddDeptFollowUpInput): Promise<string> {
  const followUpId = await createDocument(COLLECTIONS.SPARKED_DEPT_FOLLOWUPS, {
    deptId: input.deptId,
    date: Timestamp.now(),
    meetingNotes: input.meetingNotes,
    updatedCount: input.updatedCount,
    updatedAmount: input.updatedAmount,
    nextFollowUpDate: input.nextFollowUpDate ? toTimestamp(input.nextFollowUpDate) : undefined,
    loggedBy: input.loggedBy,
  });

  const deptUpdate: Record<string, unknown> = {};
  if (input.nextFollowUpDate) deptUpdate.nextFollowUpDate = toTimestamp(input.nextFollowUpDate);
  if (input.updatedCount !== undefined) deptUpdate.approxCount = input.updatedCount;
  if (input.updatedAmount !== undefined) deptUpdate.rateDiscussed = input.updatedAmount;
  if (Object.keys(deptUpdate).length > 0) {
    await updateDocument(COLLECTIONS.SPARKED_DEPARTMENTS, input.deptId, deptUpdate);
  }

  return followUpId;
}

// ============================================
// MOU signing
// ============================================

// Signs a single department's MOU without affecting siblings.
export async function signDepartmentMou(deptId: string, userId: string): Promise<void> {
  const department = await getDepartmentById(deptId);
  if (!department) throw new Error("Department not found");

  await updateDocument(COLLECTIONS.SPARKED_DEPARTMENTS, deptId, {
    status: "MOU_SIGNED" as SparkedDeptStatus,
    mouSignedVia: "DEPARTMENT",
  });

  await logMouSigned(userId, deptId, department.deptName, "DEPARTMENT");
  await recomputeCollegeMouScope(department.collegeId);
}

// Signs a college-wide MOU: batch-marks every department under the college
// as MOU_SIGNED with mouSignedVia = COLLEGE_WIDE, and sets the college's
// mouScope accordingly.
export async function signCollegeWideMou(collegeId: string, userId: string): Promise<void> {
  const college = await getCollegeById(collegeId);
  if (!college) throw new Error("College not found");

  const departments = await getDepartmentsByCollege(collegeId);
  if (departments.length === 0) {
    throw new Error("Cannot sign a college-wide MOU with no departments");
  }

  const batch = writeBatch(db);
  departments.forEach((dept) => {
    batch.update(doc(db, COLLECTIONS.SPARKED_DEPARTMENTS, dept.id), {
      status: "MOU_SIGNED",
      mouSignedVia: "COLLEGE_WIDE",
      updatedAt: Timestamp.now(),
    });
  });
  batch.update(doc(db, COLLECTIONS.SPARKED_COLLEGES, collegeId), {
    mouScope: "COLLEGE_WIDE",
    updatedAt: Timestamp.now(),
  });
  await batch.commit();

  await logMouSigned(userId, collegeId, college.collegeName, "COLLEGE_WIDE");
}

// Recomputes a college's mouScope after an individual department status change.
// COLLEGE_WIDE is only ever set by signCollegeWideMou; here we only ever
// downgrade to PARTIAL (some depts signed) or NONE (none signed).
async function recomputeCollegeMouScope(collegeId: string): Promise<void> {
  const college = await getCollegeById(collegeId);
  if (!college || college.mouScope === "COLLEGE_WIDE") return;

  const departments = await getDepartmentsByCollege(collegeId);
  const anySigned = departments.some((d) => d.status === "MOU_SIGNED");
  const newScope: MouScope = anySigned ? "PARTIAL" : "NONE";

  if (newScope !== college.mouScope) {
    await updateDocument(COLLECTIONS.SPARKED_COLLEGES, collegeId, { mouScope: newScope });
  }
}

// ============================================
// Combined reads for card rendering
// ============================================

export async function getCollegesWithDepts(): Promise<SparkedCollegeWithDepts[]> {
  const colleges = await getAllColleges();
  return Promise.all(
    colleges.map(async (college) => ({
      college,
      departments: await getDepartmentsByCollege(college.id),
    }))
  );
}

export async function getCollegeWithDepts(
  collegeId: string
): Promise<SparkedCollegeWithDepts | null> {
  const college = await getCollegeById(collegeId);
  if (!college) return null;
  return {
    college,
    departments: await getDepartmentsByCollege(collegeId),
  };
}

// Colleges that have at least one CONVERTED or MOU_SIGNED department —
// these are the ones that surface as SparkED "client" cards.
export async function getConvertedColleges(): Promise<SparkedCollegeWithDepts[]> {
  const all = await getCollegesWithDepts();
  return all.filter((c) =>
    c.departments.some((d) => d.status === "CONVERTED" || d.status === "MOU_SIGNED")
  );
}
