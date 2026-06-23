import { Timestamp } from "firebase/firestore";
import {
  COLLECTIONS,
  getDocuments,
  createDocument,
  orderBy,
  where,
  limit as firestoreLimit,
} from "./firestore";
import type { ActivityLog, ActivityAction, ActivityEntityType } from "@/types";

export interface FirestoreActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  details?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

// Convert Firestore activity log to ActivityLog type
function toActivityLog(doc: FirestoreActivityLog): ActivityLog {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
  };
}

// Get all activity logs
export async function getAllActivityLogs(): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}

// Get recent activity logs
export async function getRecentActivityLogs(count: number = 20): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    orderBy("createdAt", "desc"),
    firestoreLimit(count)
  );
  return logs.map(toActivityLog);
}

// Get activity logs by user
export async function getActivityLogsByUser(userId: string): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}

// Get activity logs by entity
export async function getActivityLogsByEntity(
  entityType: ActivityEntityType,
  entityId: string
): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    where("entityType", "==", entityType),
    where("entityId", "==", entityId),
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}

// Get activity logs by action
export async function getActivityLogsByAction(action: ActivityAction): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    where("action", "==", action),
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}

// Get activity logs by date range
export async function getActivityLogsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    where("createdAt", ">=", Timestamp.fromDate(startDate)),
    where("createdAt", "<=", Timestamp.fromDate(endDate)),
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}

// Get today's activity logs
export async function getTodayActivityLogs(): Promise<ActivityLog[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getActivityLogsByDateRange(today, tomorrow);
}

// Create activity log
export async function logActivity(
  data: Omit<ActivityLog, "id" | "createdAt">
): Promise<string> {
  return createDocument(COLLECTIONS.ACTIVITY_LOGS, data as Omit<FirestoreActivityLog, "id">);
}

// Convenience functions for logging specific actions

export async function logProjectCreated(
  userId: string,
  projectId: string,
  projectName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "PROJECT",
    entityId: projectId,
    entityName: projectName,
    details: `Created project "${projectName}"`,
  });
}

export async function logProjectUpdated(
  userId: string,
  projectId: string,
  projectName: string,
  changes?: string
): Promise<string> {
  return logActivity({
    userId,
    action: "UPDATE",
    entityType: "PROJECT",
    entityId: projectId,
    entityName: projectName,
    details: changes || `Updated project "${projectName}"`,
  });
}

export async function logProjectDeleted(
  userId: string,
  projectId: string,
  projectName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "DELETE",
    entityType: "PROJECT",
    entityId: projectId,
    entityName: projectName,
    details: `Deleted project "${projectName}"`,
  });
}

export async function logClientCreated(
  userId: string,
  clientId: string,
  clientName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "CLIENT",
    entityId: clientId,
    entityName: clientName,
    details: `Added new client "${clientName}"`,
  });
}

export async function logInvoiceCreated(
  userId: string,
  invoiceId: string,
  invoiceNumber: string,
  clientName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "INVOICE",
    entityId: invoiceId,
    entityName: invoiceNumber,
    details: `Created invoice ${invoiceNumber} for ${clientName}`,
  });
}

export async function logPaymentReceived(
  userId: string,
  invoiceId: string,
  invoiceNumber: string,
  amount: number
): Promise<string> {
  return logActivity({
    userId,
    action: "PAYMENT",
    entityType: "INVOICE",
    entityId: invoiceId,
    entityName: invoiceNumber,
    details: `Received payment of ₹${amount.toLocaleString()} for ${invoiceNumber}`,
    metadata: { amount },
  });
}

export async function logExpenseCreated(
  userId: string,
  expenseId: string,
  description: string,
  amount: number
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "EXPENSE",
    entityId: expenseId,
    entityName: description,
    details: `Recorded expense of ₹${amount.toLocaleString()} for "${description}"`,
    metadata: { amount },
  });
}

export async function logWithdrawalRequested(
  userId: string,
  withdrawalId: string,
  amount: number
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "WITHDRAWAL",
    entityId: withdrawalId,
    entityName: `Withdrawal Request`,
    details: `Requested withdrawal of ₹${amount.toLocaleString()}`,
    metadata: { amount },
  });
}

export async function logWithdrawalApproved(
  userId: string,
  withdrawalId: string,
  amount: number,
  founderName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "APPROVE",
    entityType: "WITHDRAWAL",
    entityId: withdrawalId,
    entityName: `Withdrawal for ${founderName}`,
    details: `Approved withdrawal of ₹${amount.toLocaleString()} for ${founderName}`,
    metadata: { amount, founderName },
  });
}

export async function logDocumentUploaded(
  userId: string,
  documentId: string,
  documentName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "UPLOAD",
    entityType: "DOCUMENT",
    entityId: documentId,
    entityName: documentName,
    details: `Uploaded document "${documentName}"`,
  });
}

export async function logStatusChange(
  userId: string,
  entityType: FirestoreActivityLog["entityType"],
  entityId: string,
  entityName: string,
  oldStatus: string,
  newStatus: string
): Promise<string> {
  return logActivity({
    userId,
    action: "STATUS_CHANGE",
    entityType,
    entityId,
    entityName,
    details: `Changed status from "${oldStatus}" to "${newStatus}"`,
    metadata: { oldStatus, newStatus },
  });
}

// Note activity logging
export async function logNoteCreated(
  userId: string,
  noteId: string,
  noteTitle: string,
  isPinned: boolean = false
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "NOTE",
    entityId: noteId,
    entityName: noteTitle,
    details: isPinned ? `Created pinned note "${noteTitle}"` : `Created note "${noteTitle}"`,
    metadata: { isPinned },
  });
}

export async function logNoteUpdated(
  userId: string,
  noteId: string,
  noteTitle: string
): Promise<string> {
  return logActivity({
    userId,
    action: "UPDATE",
    entityType: "NOTE",
    entityId: noteId,
    entityName: noteTitle,
    details: `Updated note "${noteTitle}"`,
  });
}

export async function logNoteDeleted(
  userId: string,
  noteId: string,
  noteTitle: string
): Promise<string> {
  return logActivity({
    userId,
    action: "DELETE",
    entityType: "NOTE",
    entityId: noteId,
    entityName: noteTitle,
    details: `Deleted note "${noteTitle}"`,
  });
}

export async function logNotePinned(
  userId: string,
  noteId: string,
  noteTitle: string,
  isPinned: boolean
): Promise<string> {
  return logActivity({
    userId,
    action: "UPDATE",
    entityType: "NOTE",
    entityId: noteId,
    entityName: noteTitle,
    details: isPinned ? `Pinned note "${noteTitle}"` : `Unpinned note "${noteTitle}"`,
    metadata: { isPinned },
  });
}

// Intern activity logging — these create an immutable audit trail
// The log survives even if the intern record is deleted afterward

export async function logInternCreated(
  userId: string,
  internId: string,
  internName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "CREATE",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: `Added intern "${internName}"`,
  });
}

export async function logInternDeleted(
  userId: string,
  internId: string,
  internName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "DELETE",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: `Deleted intern "${internName}"`,
  });
}

export async function logCertificateGenerated(
  userId: string,
  internId: string,
  internName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "GENERATE_CERTIFICATE",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: `Generated completion certificate for "${internName}"`,
  });
}

export async function logOfferLetterGenerated(
  userId: string,
  internId: string,
  internName: string
): Promise<string> {
  return logActivity({
    userId,
    action: "GENERATE_OFFER_LETTER",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: `Generated offer letter for "${internName}"`,
  });
}

export async function logPayslipGenerated(
  userId: string,
  internId: string,
  internName: string,
  month?: string
): Promise<string> {
  return logActivity({
    userId,
    action: "GENERATE_PAYSLIP",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: month
      ? `Generated payslip for "${internName}" (${month})`
      : `Generated payslip for "${internName}"`,
    metadata: month ? { month } : undefined,
  });
}

export async function logAttendanceGenerated(
  userId: string,
  internId: string,
  internName: string,
  month?: string
): Promise<string> {
  return logActivity({
    userId,
    action: "GENERATE_ATTENDANCE",
    entityType: "INTERN",
    entityId: internId,
    entityName: internName,
    details: month
      ? `Generated attendance report for "${internName}" (${month})`
      : `Generated attendance report for "${internName}"`,
    metadata: month ? { month } : undefined,
  });
}

// Get activity logs for all interns (for admin audit view)
export async function getInternActivityLogs(): Promise<ActivityLog[]> {
  const logs = await getDocuments<FirestoreActivityLog>(
    COLLECTIONS.ACTIVITY_LOGS,
    where("entityType", "==", "INTERN"),
    orderBy("createdAt", "desc")
  );
  return logs.map(toActivityLog);
}
