import { Timestamp } from "firebase/firestore";
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
  Workshop,
  WorkshopStatus,
  WorkshopExpense,
  WorkshopExpenseCategory,
  WorkshopFinancials,
  SparkedAnalytics,
} from "@/types";

export interface FirestoreWorkshop {
  id: string;
  deptId: string;
  collegeId: string;
  workshopTitle: string;
  targetYear: string;
  durationDays: number;
  startDate: Timestamp;
  endDate: Timestamp;
  status: WorkshopStatus;
  studentCount?: number;
  costPerStudent?: number;
  expenses: WorkshopExpense[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toWorkshop(doc: FirestoreWorkshop): Workshop {
  return {
    ...doc,
    startDate: doc.startDate.toDate(),
    endDate: doc.endDate.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getWorkshopById(id: string): Promise<Workshop | null> {
  const workshop = await getDocument<FirestoreWorkshop>(COLLECTIONS.SPARKED_WORKSHOPS, id);
  if (!workshop) return null;
  return toWorkshop(workshop);
}

export async function getWorkshopsByDept(deptId: string): Promise<Workshop[]> {
  const workshops = await getDocuments<FirestoreWorkshop>(
    COLLECTIONS.SPARKED_WORKSHOPS,
    where("deptId", "==", deptId)
  );
  return workshops.map(toWorkshop).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

export async function getWorkshopsByCollege(collegeId: string): Promise<Workshop[]> {
  const workshops = await getDocuments<FirestoreWorkshop>(
    COLLECTIONS.SPARKED_WORKSHOPS,
    where("collegeId", "==", collegeId)
  );
  return workshops.map(toWorkshop).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

export async function getAllWorkshops(): Promise<Workshop[]> {
  const workshops = await getDocuments<FirestoreWorkshop>(
    COLLECTIONS.SPARKED_WORKSHOPS,
    orderBy("startDate", "desc")
  );
  return workshops.map(toWorkshop);
}

export async function createWorkshop(
  data: Omit<Workshop, "id" | "status" | "createdAt" | "updatedAt"> & { status?: WorkshopStatus }
): Promise<string> {
  return createDocument(COLLECTIONS.SPARKED_WORKSHOPS, {
    ...data,
    startDate: toTimestamp(data.startDate),
    endDate: toTimestamp(data.endDate),
    status: data.status || "SCHEDULED",
  } as Omit<FirestoreWorkshop, "id">);
}

export async function updateWorkshop(
  id: string,
  data: Partial<Omit<Workshop, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.startDate) updateData.startDate = toTimestamp(data.startDate);
  if (data.endDate) updateData.endDate = toTimestamp(data.endDate);
  await updateDocument(COLLECTIONS.SPARKED_WORKSHOPS, id, updateData);
}

export async function deleteWorkshop(id: string): Promise<void> {
  await deleteDocument(COLLECTIONS.SPARKED_WORKSHOPS, id);
}

// Calculated financials for a single workshop — never stored.
export function getWorkshopFinancials(workshop: Workshop): WorkshopFinancials {
  const totalEarnings = (workshop.studentCount || 0) * (workshop.costPerStudent || 0);
  const totalExpenses = workshop.expenses.reduce((sum, e) => sum + e.totalAmount, 0);
  return {
    totalEarnings,
    totalExpenses,
    netMargin: totalEarnings - totalExpenses,
  };
}

const EXPENSE_CATEGORIES: WorkshopExpenseCategory[] = [
  "FOOD",
  "TRAVEL",
  "STAY",
  "CERTIFICATES",
  "SPECIAL_PRIZE",
  "TRAINER_FEE",
  "MATERIALS",
  "MISCELLANEOUS",
];

// Aggregate SparkED-wide analytics for the Clients page header — computed
// entirely client-side from colleges/departments/workshops, no stored
// aggregates. Never touches incomes; earnings/expenses here are purely
// informational rollups of workshop records.
export async function getSparkedAnalytics(): Promise<SparkedAnalytics> {
  const { getAllColleges } = await import("./sparkedLeadService");

  const [colleges, workshops] = await Promise.all([getAllColleges(), getAllWorkshops()]);

  const mouSignedColleges = colleges.filter(
    (c) => c.mouScope === "COLLEGE_WIDE" || c.mouScope === "PARTIAL"
  ).length;

  const totalStudentsTrained = workshops.reduce((sum, w) => sum + (w.studentCount || 0), 0);

  const expenseByCategory = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {} as Record<WorkshopExpenseCategory, number>);

  let totalEarnings = 0;
  let totalExpenses = 0;

  workshops.forEach((w) => {
    const financials = getWorkshopFinancials(w);
    totalEarnings += financials.totalEarnings;
    totalExpenses += financials.totalExpenses;
    w.expenses.forEach((e) => {
      expenseByCategory[e.category] += e.totalAmount;
    });
  });

  return {
    totalColleges: colleges.length,
    mouSignedColleges,
    totalWorkshops: workshops.length,
    totalStudentsTrained,
    totalEarnings,
    totalExpenses,
    netMargin: totalEarnings - totalExpenses,
    expenseByCategory,
  };
}
