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
} from "./firestore";
import type { Income, IncomeCategory } from "@/types";

export interface FirestoreIncome {
  id: string;
  description: string;
  amount: number;
  category: IncomeCategory;
  date: Timestamp;
  clientId?: string;
  projectId?: string;
  receivedBy: string;
  receipt?: string;
  notes?: string;
  createdAt: Timestamp;
}

// Convert Firestore income to Income type
function toIncome(doc: FirestoreIncome): Income {
  return {
    ...doc,
    date: doc.date.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

// Get income by ID
export async function getIncomeById(incomeId: string): Promise<Income | null> {
  const income = await getDocument<FirestoreIncome>(COLLECTIONS.INCOMES, incomeId);
  if (!income) return null;
  return toIncome(income);
}

// Get all incomes
export async function getAllIncomes(): Promise<Income[]> {
  const incomes = await getDocuments<FirestoreIncome>(
    COLLECTIONS.INCOMES,
    orderBy("date", "desc")
  );
  return incomes.map(toIncome);
}

// Get incomes by category
export async function getIncomesByCategory(category: IncomeCategory): Promise<Income[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const incomes = await getDocuments<FirestoreIncome>(
    COLLECTIONS.INCOMES,
    where("category", "==", category)
  );
  return incomes.map(toIncome).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Get incomes by date range
export async function getIncomesByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Income[]> {
  const incomes = await getDocuments<FirestoreIncome>(
    COLLECTIONS.INCOMES,
    where("date", ">=", Timestamp.fromDate(startDate)),
    where("date", "<=", Timestamp.fromDate(endDate))
  );
  return incomes.map(toIncome).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Get incomes by client
export async function getIncomesByClient(clientId: string): Promise<Income[]> {
  const incomes = await getDocuments<FirestoreIncome>(
    COLLECTIONS.INCOMES,
    where("clientId", "==", clientId)
  );
  return incomes.map(toIncome).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Get incomes by project
export async function getIncomesByProject(projectId: string): Promise<Income[]> {
  const incomes = await getDocuments<FirestoreIncome>(
    COLLECTIONS.INCOMES,
    where("projectId", "==", projectId)
  );
  return incomes.map(toIncome).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Get this month's incomes
export async function getThisMonthIncomes(): Promise<Income[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return getIncomesByDateRange(startOfMonth, endOfMonth);
}

// Create income
export async function createIncome(
  data: Omit<Income, "id" | "createdAt">
): Promise<string> {
  return createDocument(COLLECTIONS.INCOMES, {
    ...data,
    date: Timestamp.fromDate(data.date),
    receipt: data.receipt || null,
  });
}

// Update income
export async function updateIncome(
  incomeId: string,
  data: Partial<Omit<Income, "id" | "createdAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = Timestamp.fromDate(data.date);
  await updateDocument(COLLECTIONS.INCOMES, incomeId, updateData);
}

// Delete income
export async function deleteIncome(incomeId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.INCOMES, incomeId);
}

// Get total income (non-invoice income)
export async function getTotalIncome(): Promise<number> {
  const incomes = await getAllIncomes();
  return incomes.reduce((sum, inc) => sum + inc.amount, 0);
}

// Get this month's total income
export async function getThisMonthTotalIncome(): Promise<number> {
  const incomes = await getThisMonthIncomes();
  return incomes.reduce((sum, inc) => sum + inc.amount, 0);
}
