import {
  COLLECTIONS,
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  toDate,
  toTimestamp,
  orderBy,
  query,
  collection,
  getDocs,
  limit,
  where,
} from "./firestore";
import { db } from "@/config/firebase";
import type { Intern, InternPaymentStatus, InternDuration, InternMode } from "@/types";

// Convert Firestore data to Intern type
function convertIntern(data: Record<string, unknown>): Intern {
  return {
    ...data,
    startDate: toDate(data.startDate as Date) || new Date(),
    endDate: toDate(data.endDate as Date) || new Date(),
    issueDate: toDate(data.issueDate as Date) || new Date(),
    createdAt: toDate(data.createdAt as Date) || new Date(),
    updatedAt: toDate(data.updatedAt as Date) || new Date(),
  } as Intern;
}

// Generate next intern ID (WBINT001, WBINT002, etc.)
export async function generateNextInternId(): Promise<string> {
  const q = query(
    collection(db, COLLECTIONS.INTERNS),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return "WBINT001";
  }

  const lastIntern = snapshot.docs[0].data();
  const lastId = lastIntern.internId as string;

  // Extract number from WBINT001 format
  const numPart = parseInt(lastId.replace("WBINT", ""), 10);
  const nextNum = numPart + 1;

  // Pad with zeros to maintain format
  return `WBINT${nextNum.toString().padStart(3, "0")}`;
}

// Get all interns
export async function getInterns(): Promise<Intern[]> {
  const interns = await getDocuments<Intern>(
    COLLECTIONS.INTERNS,
    orderBy("createdAt", "desc")
  );
  return interns.map((intern) => convertIntern(intern as unknown as Record<string, unknown>));
}

// Get intern by ID
export async function getInternById(id: string): Promise<Intern | null> {
  const interns = await getDocuments<Intern>(
    COLLECTIONS.INTERNS,
    where("__name__", "==", id)
  );
  if (interns.length === 0) return null;
  return convertIntern(interns[0] as unknown as Record<string, unknown>);
}

// Get interns by filter
export async function getInternsByFilter(filters: {
  college?: string;
  year?: string;
  domain?: string;
  paymentStatus?: InternPaymentStatus;
}): Promise<Intern[]> {
  let interns = await getInterns();

  if (filters.college) {
    interns = interns.filter(i =>
      i.college.toLowerCase().includes(filters.college!.toLowerCase())
    );
  }
  if (filters.year) {
    interns = interns.filter(i => i.year === filters.year);
  }
  if (filters.domain) {
    interns = interns.filter(i => i.domain === filters.domain);
  }
  if (filters.paymentStatus) {
    interns = interns.filter(i => i.paymentStatus === filters.paymentStatus);
  }

  return interns;
}

// Create new intern
export async function createIntern(data: {
  name: string;
  email: string;
  phone: string;
  college: string;
  year: string;
  domain: string;
  duration: InternDuration;
  startDate: Date;
  endDate: Date;
  issueDate: Date;
  paymentStatus: InternPaymentStatus;
}): Promise<string> {
  const internId = await generateNextInternId();

  return createDocument(COLLECTIONS.INTERNS, {
    ...data,
    internId,
    startDate: toTimestamp(data.startDate),
    endDate: toTimestamp(data.endDate),
    issueDate: toTimestamp(data.issueDate),
  });
}

// Update intern
export async function updateIntern(
  id: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    college: string;
    year: string;
    domain: string;
    duration: InternDuration;
    startDate: Date;
    endDate: Date;
    issueDate: Date;
    paymentStatus: InternPaymentStatus;
    certificateUrl: string;
    certificateKey: string;
    attendanceUrl: string;
    attendanceKey: string;
    totalInternshipDays: number;
    daysPresent: number;
    payslipUrl: string;
    payslipKey: string;
    referenceNumber: string;
    numberOfMonths: number;
    paymentType: 'MONTHLY' | 'ONE_TIME';
  }>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };

  if (data.startDate) updateData.startDate = toTimestamp(data.startDate);
  if (data.endDate) updateData.endDate = toTimestamp(data.endDate);
  if (data.issueDate) updateData.issueDate = toTimestamp(data.issueDate);

  return updateDocument(COLLECTIONS.INTERNS, id, updateData);
}

// Delete intern
export async function deleteIntern(id: string): Promise<void> {
  return deleteDocument(COLLECTIONS.INTERNS, id);
}

// Bulk delete interns
export async function bulkDeleteInterns(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => deleteDocument(COLLECTIONS.INTERNS, id)));
}

// Bulk create interns
export async function bulkCreateInterns(
  internsData: Array<{
    name: string;
    email: string;
    phone: string;
    college: string;
    year: string;
    domain: string;
    duration: InternDuration;
    startDate: Date;
    endDate: Date;
    issueDate: Date;
    paymentStatus: InternPaymentStatus;
  }>
): Promise<string[]> {
  const ids: string[] = [];

  // Get the starting intern ID
  let nextId = await generateNextInternId();
  let numPart = parseInt(nextId.replace("WBINT", ""), 10);

  for (const data of internsData) {
    const internId = `WBINT${numPart.toString().padStart(3, "0")}`;

    const id = await createDocument(COLLECTIONS.INTERNS, {
      ...data,
      internId,
      startDate: toTimestamp(data.startDate),
      endDate: toTimestamp(data.endDate),
      issueDate: toTimestamp(data.issueDate),
    });

    ids.push(id);
    numPart++;
  }

  return ids;
}

// Update certificate URL for intern
export async function updateInternCertificate(
  id: string,
  certificateUrl: string,
  certificateKey: string
): Promise<void> {
  return updateDocument(COLLECTIONS.INTERNS, id, {
    certificateUrl,
    certificateKey,
  });
}

// Update offer letter URL for intern
export async function updateInternOfferLetter(
  id: string,
  offerLetterUrl: string,
  offerLetterKey: string
): Promise<void> {
  return updateDocument(COLLECTIONS.INTERNS, id, {
    offerLetterUrl,
    offerLetterKey,
  });
}

// Update attendance URL for intern
export async function updateInternAttendance(
  id: string,
  attendanceUrl: string,
  attendanceKey: string
): Promise<void> {
  return updateDocument(COLLECTIONS.INTERNS, id, {
    attendanceUrl,
    attendanceKey,
  });
}

// Update payslip URL for intern
export async function updateInternPayslip(
  id: string,
  payslipUrl: string,
  payslipKey: string
): Promise<void> {
  return updateDocument(COLLECTIONS.INTERNS, id, {
    payslipUrl,
    payslipKey,
  });
}

// Update intern offer letter fields (mode, stipend, projectTitle)
export async function updateInternOfferLetterFields(
  id: string,
  data: {
    mode?: InternMode;
    stipend?: number;
    projectTitle?: string;
  }
): Promise<void> {
  return updateDocument(COLLECTIONS.INTERNS, id, data);
}
