import { Timestamp } from "firebase/firestore";
import {
  COLLECTIONS,
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  orderBy,
  where,
} from "./firestore";
import type { Expense, ExpenseCategory } from "@/types";

export interface FirestoreExpense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Timestamp;
  paidBy: string; // "COMPANY" or founder userId
  receipt?: string; // Optional - URL to receipt file
  notes?: string;
  createdAt: Timestamp;
}

// Convert Firestore expense to Expense type
function toExpense(doc: FirestoreExpense): Expense {
  return {
    ...doc,
    date: doc.date.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

// Get all expenses
export async function getAllExpenses(): Promise<Expense[]> {
  const expenses = await getDocuments<FirestoreExpense>(
    COLLECTIONS.EXPENSES,
    orderBy("date", "desc")
  );
  return expenses.map(toExpense);
}

// Get expenses by category
export async function getExpensesByCategory(category: ExpenseCategory): Promise<Expense[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const expenses = await getDocuments<FirestoreExpense>(
    COLLECTIONS.EXPENSES,
    where("category", "==", category)
  );
  return expenses.map(toExpense).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Get expenses by date range
export async function getExpensesByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Expense[]> {
  const expenses = await getDocuments<FirestoreExpense>(
    COLLECTIONS.EXPENSES,
    where("date", ">=", Timestamp.fromDate(startDate)),
    where("date", "<=", Timestamp.fromDate(endDate)),
    orderBy("date", "desc")
  );
  return expenses.map(toExpense);
}

// Get this month's expenses
export async function getThisMonthExpenses(): Promise<Expense[]> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return getExpensesByDateRange(startOfMonth, endOfMonth);
}

// Create expense
export async function createExpense(
  data: Omit<Expense, "id" | "createdAt">
): Promise<string> {
  return createDocument(COLLECTIONS.EXPENSES, {
    ...data,
    date: Timestamp.fromDate(data.date),
    receipt: data.receipt || null, // Optional field
  });
}

// Update expense
export async function updateExpense(
  expenseId: string,
  data: Partial<Omit<Expense, "id" | "createdAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = Timestamp.fromDate(data.date);
  await updateDocument(COLLECTIONS.EXPENSES, expenseId, updateData);
}

// Delete expense
export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.EXPENSES, expenseId);
}

// Get total revenue (from paid invoices + non-invoice income)
export async function getTotalRevenue(): Promise<number> {
  const { getDocuments } = await import("./firestore");

  // Get revenue from paid invoices
  const invoices = await getDocuments<{ paidAmount: number }>(
    COLLECTIONS.INVOICES
  );
  const invoiceRevenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  // Get revenue from non-invoice income (interns, advances, etc.)
  const { getTotalIncome } = await import("./incomeService");
  const nonInvoiceIncome = await getTotalIncome();

  return invoiceRevenue + nonInvoiceIncome;
}

// Get this month's revenue (from invoices + income)
export async function getThisMonthRevenue(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Invoice revenue this month
  const invoices = await getDocuments<{ paidAmount: number; updatedAt: Timestamp }>(
    COLLECTIONS.INVOICES,
    where("updatedAt", ">=", Timestamp.fromDate(startOfMonth))
  );
  const invoiceRevenue = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  // Non-invoice income this month
  const { getThisMonthTotalIncome } = await import("./incomeService");
  const nonInvoiceIncome = await getThisMonthTotalIncome();

  return invoiceRevenue + nonInvoiceIncome;
}

// Get total expenses
export async function getTotalExpenses(): Promise<number> {
  const expenses = await getAllExpenses();
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

// Get net profit
export async function getNetProfit(): Promise<number> {
  const revenue = await getTotalRevenue();
  const expenses = await getTotalExpenses();
  return revenue - expenses;
}

// Get company bank balance (net profit - approved withdrawals only)
export async function getCompanyBankBalance(): Promise<number> {
  const netProfit = await getNetProfit();
  const { getAllWithdrawals } = await import("./withdrawalService");
  const withdrawals = await getAllWithdrawals();
  // Only count APPROVED withdrawals toward bank balance
  const totalWithdrawals = withdrawals
    .filter((w) => w.status === "APPROVED")
    .reduce((sum, w) => sum + w.amount, 0);
  return netProfit - totalWithdrawals;
}

// Get financial summary
export async function getFinancialSummary(): Promise<{
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  bankBalance: number;
  pendingPayments: number;
  thisMonthRevenue: number;
}> {
  const { getPendingPaymentsTotal } = await import("./invoiceService");

  const [totalRevenue, totalExpenses, pendingPayments, thisMonthRevenue] = await Promise.all([
    getTotalRevenue(),
    getTotalExpenses(),
    getPendingPaymentsTotal(),
    getThisMonthRevenue(),
  ]);

  const netProfit = totalRevenue - totalExpenses;
  const { getAllWithdrawals } = await import("./withdrawalService");
  const withdrawals = await getAllWithdrawals();
  // Only count APPROVED withdrawals toward bank balance
  const totalWithdrawals = withdrawals
    .filter((w) => w.status === "APPROVED")
    .reduce((sum, w) => sum + w.amount, 0);
  const bankBalance = netProfit - totalWithdrawals;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    bankBalance,
    pendingPayments,
    thisMonthRevenue,
  };
}
