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

// Create withdrawal request
export async function createWithdrawal(
  data: Omit<Withdrawal, "id" | "createdAt" | "status">
): Promise<string> {
  return createDocument(COLLECTIONS.WITHDRAWALS, {
    ...data,
    date: Timestamp.fromDate(data.date),
    status: "PENDING",
  });
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

// Delete withdrawal
export async function deleteWithdrawal(withdrawalId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.WITHDRAWALS, withdrawalId);
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
