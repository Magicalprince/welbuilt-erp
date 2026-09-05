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
import type { Withdrawal, WithdrawalStatus } from "@/types";
import { createExpense, updateExpense, deleteExpense } from "./financeService";
import { getUserById } from "./userService";
import { logWithdrawalRequested, logWithdrawalApproved } from "./activityLogService";

export interface FirestoreWithdrawal {
  id: string;
  founderId: string;
  amount: number;
  date: Timestamp;
  status: WithdrawalStatus;
  approvedBy?: string;
  notes?: string;
  createdAt: Timestamp;
}

// Convert Firestore withdrawal to Withdrawal type
function toWithdrawal(doc: FirestoreWithdrawal): Withdrawal {
  return {
    ...doc,
    date: doc.date.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

// Get withdrawal by ID
export async function getWithdrawalById(withdrawalId: string): Promise<Withdrawal | null> {
  const withdrawal = await getDocument<FirestoreWithdrawal>(COLLECTIONS.WITHDRAWALS, withdrawalId);
  if (!withdrawal) return null;
  return toWithdrawal(withdrawal);
}

// Get all withdrawals
export async function getAllWithdrawals(): Promise<Withdrawal[]> {
  const withdrawals = await getDocuments<FirestoreWithdrawal>(
    COLLECTIONS.WITHDRAWALS,
    orderBy("date", "desc")
  );
  return withdrawals.map(toWithdrawal);
}

// Get withdrawals by founder
export async function getWithdrawalsByFounder(founderId: string): Promise<Withdrawal[]> {
  try {
    // Query without orderBy to avoid needing composite index
    const withdrawals = await getDocuments<FirestoreWithdrawal>(
      COLLECTIONS.WITHDRAWALS,
      where("founderId", "==", founderId)
    );
    // Sort in JavaScript instead
    return withdrawals
      .map(toWithdrawal)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error fetching withdrawals for founder:", founderId, error);
    // Return empty array if no withdrawals collection exists yet
    return [];
  }
}

// Get withdrawals by status
export async function getWithdrawalsByStatus(status: WithdrawalStatus): Promise<Withdrawal[]> {
  try {
    const withdrawals = await getDocuments<FirestoreWithdrawal>(
      COLLECTIONS.WITHDRAWALS,
      where("status", "==", status)
    );
    return withdrawals
      .map(toWithdrawal)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error fetching withdrawals by status:", status, error);
    return [];
  }
}

// Get pending withdrawals
export async function getPendingWithdrawals(): Promise<Withdrawal[]> {
  return getWithdrawalsByStatus("PENDING");
}

// Create withdrawal (directly as approved/successful) and record as expense
export async function createWithdrawal(
  data: Omit<Withdrawal, "id" | "createdAt" | "status" | "expenseId">
): Promise<string> {
  // Get founder name for expense description
  const founder = await getUserById(data.founderId);
  const founderName = founder?.name || "Founder";

  // Create the linked expense first so its id can be stored on the
  // withdrawal — lets edit/delete keep both records in sync later instead
  // of leaving the expense orphaned.
  const expenseId = await createExpense({
    description: `Founder Withdrawal - ${founderName}`,
    amount: data.amount,
    category: "FOUNDER_WITHDRAWAL",
    date: data.date,
    paidBy: "COMPANY",
    notes: data.notes || `Withdrawal by ${founderName}`,
  });

  const withdrawalId = await createDocument(COLLECTIONS.WITHDRAWALS, {
    ...data,
    date: Timestamp.fromDate(data.date),
    status: "APPROVED",
    expenseId,
  });

  // Withdrawals are created already-approved, so log both events for the audit trail
  await logWithdrawalRequested(data.founderId, withdrawalId, data.amount);
  await logWithdrawalApproved(data.founderId, withdrawalId, data.amount, founderName);

  return withdrawalId;
}

// Update withdrawal — keeps the linked expense's amount/date/notes in sync
// so editing a withdrawal doesn't desync it from the expense ledger.
export async function updateWithdrawal(
  withdrawalId: string,
  data: Partial<Pick<Withdrawal, "amount" | "date" | "notes">>
): Promise<void> {
  const existing = await getWithdrawalById(withdrawalId);
  if (!existing) throw new Error("Withdrawal not found");

  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = Timestamp.fromDate(data.date);
  await updateDocument(COLLECTIONS.WITHDRAWALS, withdrawalId, updateData);

  if (existing.expenseId) {
    await updateExpense(existing.expenseId, {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.notes !== undefined && { notes: data.notes }),
    });
  }
}

// Approve withdrawal
export async function approveWithdrawal(
  withdrawalId: string,
  approvedBy: string
): Promise<void> {
  await updateDocument(COLLECTIONS.WITHDRAWALS, withdrawalId, {
    status: "APPROVED",
    approvedBy,
  });
}

// Reject withdrawal
export async function rejectWithdrawal(
  withdrawalId: string,
  notes?: string
): Promise<void> {
  await updateDocument(COLLECTIONS.WITHDRAWALS, withdrawalId, {
    status: "REJECTED",
    notes,
  });
}

// Delete withdrawal — also deletes its linked expense record where one
// exists, so deleting a withdrawal doesn't leave a "Founder Withdrawal"
// expense behind with nothing pointing back to it. Withdrawals created
// before expenseId was tracked won't have a link to clean up.
export async function deleteWithdrawal(withdrawalId: string): Promise<void> {
  const existing = await getWithdrawalById(withdrawalId);
  await deleteDocument(COLLECTIONS.WITHDRAWALS, withdrawalId);
  if (existing?.expenseId) {
    await deleteExpense(existing.expenseId);
  }
}

// Get total withdrawals by founder
export async function getTotalWithdrawalsByFounder(founderId: string): Promise<number> {
  try {
    const withdrawals = await getDocuments<FirestoreWithdrawal>(
      COLLECTIONS.WITHDRAWALS,
      where("founderId", "==", founderId)
    );
    // Filter approved withdrawals in JavaScript
    return withdrawals
      .filter((w) => w.status === "APPROVED")
      .reduce((sum, w) => sum + w.amount, 0);
  } catch (error) {
    console.error("Error getting total withdrawals for founder:", founderId, error);
    return 0;
  }
}

// Get this month's withdrawals
export async function getThisMonthWithdrawals(): Promise<Withdrawal[]> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all withdrawals and filter in JS to avoid index requirement
    const withdrawals = await getDocuments<FirestoreWithdrawal>(COLLECTIONS.WITHDRAWALS);

    return withdrawals
      .filter((w) => w.date.toDate() >= startOfMonth)
      .map(toWithdrawal)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error getting this month's withdrawals:", error);
    return [];
  }
}
