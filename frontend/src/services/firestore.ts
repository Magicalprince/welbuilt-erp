import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/config/firebase";

// Collection names - centralized for consistency
export const COLLECTIONS = {
  USERS: "users",
  CLIENTS: "clients",
  PROJECTS: "projects",
  PROJECT_PHASES: "projectPhases",
  PROJECT_MVP: "projectMvpFeatures",
  INVOICES: "invoices",
  INVOICE_PAYMENTS: "invoicePayments",
  QUOTATIONS: "quotations",
  EXPENSES: "expenses",
  INCOMES: "incomes",
  WITHDRAWALS: "withdrawals",
  NOTES: "notes",
  COMMENTS: "comments",
  DOCUMENTS: "documents",
  ACTIVITY_LOGS: "activityLogs",
  COMMUNICATIONS: "communications",
  SETTINGS: "settings",
  INTERNS: "interns",
} as const;

// Helper to convert Firestore Timestamp to Date
export const toDate = (timestamp: Timestamp | Date | undefined): Date | undefined => {
  if (!timestamp) return undefined;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  return timestamp;
};

// Helper to convert Date to Firestore Timestamp
export const toTimestamp = (date: Date | undefined): Timestamp | undefined => {
  if (!date) return undefined;
  return Timestamp.fromDate(date);
};

// Generic CRUD operations
export async function getDocument<T>(collectionName: string, docId: string): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

export async function getDocuments<T>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, "id">
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateDocument<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteDocument(collectionName: string, docId: string): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

// Batch operations
export function createBatch() {
  return writeBatch(db);
}

export { query, where, orderBy, limit, Timestamp, collection, doc, getDocs };
