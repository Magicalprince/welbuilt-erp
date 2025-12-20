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
import type { Client, ClientStatus } from "@/types";

export interface FirestoreClient {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  status: ClientStatus;
  source?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Convert Firestore client to Client type
function toClient(doc: FirestoreClient): Client {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

// Get client by ID
export async function getClientById(clientId: string): Promise<Client | null> {
  const client = await getDocument<FirestoreClient>(COLLECTIONS.CLIENTS, clientId);
  if (!client) return null;
  return toClient(client);
}

// Get all clients
export async function getAllClients(): Promise<Client[]> {
  const clients = await getDocuments<FirestoreClient>(
    COLLECTIONS.CLIENTS,
    orderBy("createdAt", "desc")
  );
  return clients.map(toClient);
}

// Get clients by status
export async function getClientsByStatus(status: ClientStatus): Promise<Client[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const clients = await getDocuments<FirestoreClient>(
    COLLECTIONS.CLIENTS,
    where("status", "==", status)
  );
  return clients.map(toClient).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get active clients count
export async function getActiveClientsCount(): Promise<number> {
  const clients = await getDocuments<FirestoreClient>(
    COLLECTIONS.CLIENTS,
    where("status", "==", "ACTIVE")
  );
  return clients.length;
}

// Create client
export async function createClient(
  data: Omit<Client, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument(COLLECTIONS.CLIENTS, data as Omit<FirestoreClient, "id">);
}

// Update client
export async function updateClient(
  clientId: string,
  data: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.CLIENTS, clientId, data);
}

// Delete client
export async function deleteClient(clientId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.CLIENTS, clientId);
}

// Get client with project stats
export async function getClientWithStats(clientId: string): Promise<{
  client: Client;
  projectCount: number;
  totalValue: number;
  paidAmount: number;
  pendingAmount: number;
} | null> {
  const client = await getClientById(clientId);
  if (!client) return null;

  const { getProjectsByClient } = await import("./projectService");
  const { getInvoicesByClient } = await import("./invoiceService");

  const projects = await getProjectsByClient(clientId);
  const invoices = await getInvoicesByClient(clientId);

  const totalValue = projects.reduce((sum, p) => sum + p.value, 0);
  const paidAmount = invoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const pendingAmount = invoices.reduce((sum, i) => sum + (i.total - i.paidAmount), 0);

  return {
    client,
    projectCount: projects.length,
    totalValue,
    paidAmount,
    pendingAmount,
  };
}
