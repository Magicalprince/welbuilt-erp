import { Timestamp } from "firebase/firestore";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  createDocument,
  deleteDocument,
  orderBy,
  where,
} from "./firestore";
import type { Repayment } from "@/types";
import { logActivity } from "./activityLogService";
import { getUserById } from "./userService";
import { getWithdrawalsByFounder } from "./withdrawalService";

export interface FirestoreRepayment {
  id: string;
  founderId: string;
  amount: number;
  date: Timestamp;
  notes?: string;
  createdAt: Timestamp;
}

function toRepayment(doc: FirestoreRepayment): Repayment {
  return {
    ...doc,
    date: doc.date.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

// Get repayment by ID
export async function getRepaymentById(repaymentId: string): Promise<Repayment | null> {
  const repayment = await getDocument<FirestoreRepayment>(COLLECTIONS.REPAYMENTS, repaymentId);
  if (!repayment) return null;
  return toRepayment(repayment);
}

// Get all repayments
export async function getAllRepayments(): Promise<Repayment[]> {
  const repayments = await getDocuments<FirestoreRepayment>(
    COLLECTIONS.REPAYMENTS,
    orderBy("date", "desc")
  );
  return repayments.map(toRepayment);
}

// Get repayments by founder
export async function getRepaymentsByFounder(founderId: string): Promise<Repayment[]> {
  try {
    const repayments = await getDocuments<FirestoreRepayment>(
      COLLECTIONS.REPAYMENTS,
      where("founderId", "==", founderId)
    );
    return repayments
      .map(toRepayment)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error fetching repayments for founder:", founderId, error);
    return [];
  }
}

// Get total repayments by founder
export async function getTotalRepaymentsByFounder(founderId: string): Promise<number> {
  const repayments = await getRepaymentsByFounder(founderId);
  return repayments.reduce((sum, r) => sum + r.amount, 0);
}

// Get total repayments across all founders
export async function getTotalRepayments(): Promise<number> {
  const repayments = await getAllRepayments();
  return repayments.reduce((sum, r) => sum + r.amount, 0);
}

// Net amount a founder currently owes: approved withdrawals minus prior repayments
export async function getNetOwedByFounder(founderId: string): Promise<number> {
  const withdrawals = await getWithdrawalsByFounder(founderId);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "APPROVED")
    .reduce((sum, w) => sum + w.amount, 0);
  const totalRepaid = await getTotalRepaymentsByFounder(founderId);
  return totalWithdrawn - totalRepaid;
}

// Create repayment — a founder paying back part (or all) of what they've withdrawn.
// Rejects amounts exceeding what the founder currently owes, mirroring the
// over-withdrawal guard on createWithdrawal.
export async function createRepayment(
  data: Omit<Repayment, "id" | "createdAt">
): Promise<string> {
  const netOwed = await getNetOwedByFounder(data.founderId);
  if (data.amount > netOwed) {
    throw new Error("Repayment amount exceeds the founder's outstanding withdrawn balance");
  }

  const founder = await getUserById(data.founderId);
  const founderName = founder?.name || "Founder";

  const repaymentId = await createDocument(COLLECTIONS.REPAYMENTS, {
    ...data,
    date: Timestamp.fromDate(data.date),
  });

  await logActivity({
    userId: data.founderId,
    action: "PAYMENT",
    entityType: "WITHDRAWAL",
    entityId: repaymentId,
    entityName: `Repayment by ${founderName}`,
    details: `${founderName} repaid ₹${data.amount.toLocaleString()} toward withdrawn balance`,
    metadata: { amount: data.amount, founderName },
  });

  return repaymentId;
}

// Delete repayment
export async function deleteRepayment(repaymentId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.REPAYMENTS, repaymentId);
}
