import { useEffect, useCallback, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  doc,
} from "firebase/firestore";
import type { QueryConstraint } from "firebase/firestore";
import { db } from "@/config/firebase";
import { COLLECTIONS } from "@/services/firestore";
import { queryKeys } from "./useFirestore";
import type {
  Client,
  Project,
  Invoice,
  Expense,
  Withdrawal,
  Note,
  Document,
  DocumentType,
  ClientStatus,
  ProjectStatus,
} from "@/types";

// Generic timestamp converter
function convertTimestamps<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key in result) {
    const value = result[key];
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      (result as Record<string, unknown>)[key] = value.toDate();
    }
  }
  return result;
}

// ============================================
// Real-time Collection Hook
// ============================================
export function useRealtimeCollection<T>(
  collectionName: string,
  queryKey: readonly unknown[],
  constraints: QueryConstraint[] = [],
  enabled: boolean = true
) {
  const queryClient = useQueryClient();

  // Stable references for queryKey and constraints
  const queryKeyRef = useRef(queryKey);
  const constraintsRef = useRef(constraints);

  // Serialize for dependency tracking
  const queryKeyString = JSON.stringify(queryKey);
  const constraintsString = JSON.stringify(constraints.map(c => c.type));

  useEffect(() => {
    // Update refs at the start of effect
    queryKeyRef.current = queryKey;
    constraintsRef.current = constraints;

    if (!enabled) return;

    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...convertTimestamps(docSnap.data()),
        })) as T[];

        // Update React Query cache with real-time data
        queryClient.setQueryData(queryKeyRef.current, data);
      },
      (error) => {
        console.error(`Realtime subscription error for ${collectionName}:`, error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, queryClient, enabled, queryKeyString, constraintsString]);

  // Use React Query to get the cached data
  return useQuery<T[]>({
    queryKey,
    queryFn: () => queryClient.getQueryData(queryKey) as T[] ?? [],
    enabled,
    staleTime: Infinity, // Data is always fresh from subscription
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// ============================================
// Real-time Document Hook
// ============================================
export function useRealtimeDocument<T>(
  collectionName: string,
  documentId: string,
  queryKey: readonly unknown[]
) {
  const queryClient = useQueryClient();
  const enabled = !!documentId;

  // Stable reference for queryKey
  const queryKeyRef = useRef(queryKey);
  const queryKeyString = JSON.stringify(queryKey);

  useEffect(() => {
    // Update ref at the start of effect
    queryKeyRef.current = queryKey;

    if (!enabled) return;

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = {
            id: snapshot.id,
            ...convertTimestamps(snapshot.data()),
          } as T;
          queryClient.setQueryData(queryKeyRef.current, data);
        } else {
          queryClient.setQueryData(queryKeyRef.current, null);
        }
      },
      (error) => {
        console.error(`Realtime document subscription error:`, error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, documentId, queryClient, enabled, queryKeyString]);

  return useQuery<T | null>({
    queryKey,
    queryFn: () => queryClient.getQueryData(queryKey) as T | null ?? null,
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// ============================================
// Real-time Client Hooks
// ============================================
export function useRealtimeClients() {
  return useRealtimeCollection<Client>(
    COLLECTIONS.CLIENTS,
    queryKeys.clients,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeClient(clientId: string) {
  return useRealtimeDocument<Client>(
    COLLECTIONS.CLIENTS,
    clientId,
    queryKeys.client(clientId)
  );
}

export function useRealtimeClientsByStatus(status: ClientStatus) {
  return useRealtimeCollection<Client>(
    COLLECTIONS.CLIENTS,
    queryKeys.clientsByStatus(status),
    [where("status", "==", status), orderBy("createdAt", "desc")]
  );
}

// ============================================
// Real-time Project Hooks
// ============================================
export function useRealtimeProjects() {
  return useRealtimeCollection<Project>(
    COLLECTIONS.PROJECTS,
    queryKeys.projects,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeProject(projectId: string) {
  return useRealtimeDocument<Project>(
    COLLECTIONS.PROJECTS,
    projectId,
    queryKeys.project(projectId)
  );
}

export function useRealtimeProjectsByClient(clientId: string) {
  return useRealtimeCollection<Project>(
    COLLECTIONS.PROJECTS,
    queryKeys.projectsByClient(clientId),
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")],
    !!clientId
  );
}

export function useRealtimeProjectsByStatus(status: ProjectStatus) {
  return useRealtimeCollection<Project>(
    COLLECTIONS.PROJECTS,
    queryKeys.projectsByStatus(status),
    [where("status", "==", status), orderBy("createdAt", "desc")]
  );
}

// ============================================
// Real-time Invoice Hooks
// ============================================
export function useRealtimeInvoices() {
  return useRealtimeCollection<Invoice>(
    COLLECTIONS.INVOICES,
    queryKeys.invoices,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeInvoice(invoiceId: string) {
  return useRealtimeDocument<Invoice>(
    COLLECTIONS.INVOICES,
    invoiceId,
    queryKeys.invoice(invoiceId)
  );
}

export function useRealtimeInvoicesByClient(clientId: string) {
  return useRealtimeCollection<Invoice>(
    COLLECTIONS.INVOICES,
    queryKeys.invoicesByClient(clientId),
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")],
    !!clientId
  );
}

// ============================================
// Real-time Expense Hooks
// ============================================
export function useRealtimeExpenses() {
  return useRealtimeCollection<Expense>(
    COLLECTIONS.EXPENSES,
    queryKeys.expenses,
    [orderBy("createdAt", "desc")]
  );
}

// ============================================
// Real-time Withdrawal Hooks
// ============================================
export function useRealtimeWithdrawals() {
  return useRealtimeCollection<Withdrawal>(
    COLLECTIONS.WITHDRAWALS,
    queryKeys.withdrawals,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeWithdrawalsByFounder(founderId: string) {
  return useRealtimeCollection<Withdrawal>(
    COLLECTIONS.WITHDRAWALS,
    queryKeys.withdrawalsByFounder(founderId),
    [where("founderId", "==", founderId), orderBy("createdAt", "desc")],
    !!founderId
  );
}

// ============================================
// Real-time Note Hooks
// ============================================
export function useRealtimeNotes() {
  return useRealtimeCollection<Note>(
    COLLECTIONS.NOTES,
    queryKeys.notes,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeNote(noteId: string) {
  return useRealtimeDocument<Note>(
    COLLECTIONS.NOTES,
    noteId,
    queryKeys.note(noteId)
  );
}

export function useRealtimeNotesByProject(projectId: string) {
  return useRealtimeCollection<Note>(
    COLLECTIONS.NOTES,
    queryKeys.notesByProject(projectId),
    [where("projectId", "==", projectId), orderBy("createdAt", "desc")],
    !!projectId
  );
}

export function useRealtimeNotesByClient(clientId: string) {
  return useRealtimeCollection<Note>(
    COLLECTIONS.NOTES,
    queryKeys.notesByClient(clientId),
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")],
    !!clientId
  );
}

// ============================================
// Real-time Document Hooks (Firebase + R2 integration)
// ============================================
export function useRealtimeDocuments() {
  return useRealtimeCollection<Document>(
    COLLECTIONS.DOCUMENTS,
    queryKeys.documents,
    [orderBy("createdAt", "desc")]
  );
}

export function useRealtimeDocumentRecord(documentId: string) {
  return useRealtimeDocument<Document>(
    COLLECTIONS.DOCUMENTS,
    documentId,
    queryKeys.document(documentId)
  );
}

export function useRealtimeDocumentsByType(type: DocumentType) {
  return useRealtimeCollection<Document>(
    COLLECTIONS.DOCUMENTS,
    queryKeys.documentsByType(type),
    [where("type", "==", type), orderBy("createdAt", "desc")]
  );
}

export function useRealtimeDocumentsByProject(projectId: string) {
  return useRealtimeCollection<Document>(
    COLLECTIONS.DOCUMENTS,
    queryKeys.documentsByProject(projectId),
    [where("projectId", "==", projectId), orderBy("createdAt", "desc")],
    !!projectId
  );
}

export function useRealtimeDocumentsByClient(clientId: string) {
  return useRealtimeCollection<Document>(
    COLLECTIONS.DOCUMENTS,
    queryKeys.documentsByClient(clientId),
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")],
    !!clientId
  );
}

// ============================================
// Utility hook for invalidating all related queries
// ============================================
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return useCallback(
    (keys: readonly unknown[][]) => {
      keys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    [queryClient]
  );
}
