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

// Get total revenue — tracked ONLY from manually-entered Income records.
// Invoice paidAmount is informational (client payment status) and intentionally
// excluded: revenue/equity must only move when someone logs it on the Income screen.
export async function getTotalRevenue(): Promise<number> {
  const { getTotalIncome } = await import("./incomeService");
  return getTotalIncome();
}

// Get this month's revenue — same rule, Income records only.
export async function getThisMonthRevenue(): Promise<number> {
  const { getThisMonthTotalIncome } = await import("./incomeService");
  return getThisMonthTotalIncome();
}

// Get total expenses (all expenses including founder withdrawals)
export async function getTotalExpenses(): Promise<number> {
  const expenses = await getAllExpenses();
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
}

// Get operational expenses (excluding founder withdrawals)
export async function getOperationalExpenses(): Promise<number> {
  const expenses = await getAllExpenses();
  return expenses
    .filter((exp) => exp.category !== "FOUNDER_WITHDRAWAL")
    .reduce((sum, exp) => sum + exp.amount, 0);
}

// Get total founder withdrawals, net of repayments.
// This is what's actually still out of the company bank account.
export async function getTotalFounderWithdrawals(): Promise<number> {
  const { getAllWithdrawals } = await import("./withdrawalService");
  const { getTotalRepayments } = await import("./repaymentService");

  // Get approved withdrawals from withdrawals collection (source of truth)
  const [withdrawals, totalRepayments] = await Promise.all([
    getAllWithdrawals(),
    getTotalRepayments(),
  ]);
  const totalFromWithdrawals = withdrawals
    .filter((w) => w.status === "APPROVED")
    .reduce((sum, w) => sum + w.amount, 0);

  return totalFromWithdrawals - totalRepayments;
}

// Get net profit (Revenue - Operational Expenses, NOT including withdrawals)
// This represents what the company has earned
export async function getNetProfit(): Promise<number> {
  const revenue = await getTotalRevenue();
  const operationalExpenses = await getOperationalExpenses();
  return revenue - operationalExpenses;
}

// Get company bank balance (Net Profit - Withdrawals)
// This represents what's actually left in the company bank
export async function getCompanyBankBalance(): Promise<number> {
  const netProfit = await getNetProfit();
  const totalWithdrawals = await getTotalFounderWithdrawals();
  return netProfit - totalWithdrawals;
}

// Get financial summary
export async function getFinancialSummary(): Promise<{
  totalRevenue: number;
  totalExpenses: number; // Operational expenses only (excluding withdrawals)
  netProfit: number; // Revenue - Operational Expenses
  bankBalance: number; // Net Profit - Withdrawals
  totalWithdrawals: number; // Total founder withdrawals
  pendingPayments: number;
  thisMonthRevenue: number;
}> {
  const { getPendingPaymentsTotal } = await import("./invoiceService");

  const [
    totalRevenue,
    operationalExpenses,
    totalWithdrawals,
    pendingPayments,
    thisMonthRevenue,
  ] = await Promise.all([
    getTotalRevenue(),
    getOperationalExpenses(),
    getTotalFounderWithdrawals(),
    getPendingPaymentsTotal(),
    getThisMonthRevenue(),
  ]);

  // Net profit = Revenue - Operational Expenses (what the company earned)
  const netProfit = totalRevenue - operationalExpenses;

  // Bank balance = Net Profit - Withdrawals (what's left in the bank)
  const bankBalance = netProfit - totalWithdrawals;

  return {
    totalRevenue,
    totalExpenses: operationalExpenses,
    netProfit,
    bankBalance,
    totalWithdrawals,
    pendingPayments,
    thisMonthRevenue,
  };
}
