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
import type { Document, DocumentType } from "@/types";

export interface FirestoreDocument {
  id: string;
  name: string;
  type: DocumentType;
  fileUrl?: string; // Optional - URL to file in Cloudflare R2
  fileSize?: number; // Optional - in bytes
  mimeType?: string; // Optional
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Convert Firestore document to Document type
function toDocument(doc: FirestoreDocument): Document {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

// Get document by ID
export async function getDocumentById(documentId: string): Promise<Document | null> {
  const document = await getDocument<FirestoreDocument>(COLLECTIONS.DOCUMENTS, documentId);
  if (!document) return null;
  return toDocument(document);
}

// Get all documents
export async function getAllDocuments(): Promise<Document[]> {
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    orderBy("createdAt", "desc")
  );
  return documents.map(toDocument);
}

// Get documents by type
export async function getDocumentsByType(type: DocumentType): Promise<Document[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    where("type", "==", type)
  );
  return documents.map(toDocument).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get documents by project
export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    where("projectId", "==", projectId)
  );
  return documents.map(toDocument).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get documents by client
export async function getDocumentsByClient(clientId: string): Promise<Document[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    where("clientId", "==", clientId)
  );
  return documents.map(toDocument).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get documents by invoice
export async function getDocumentsByInvoice(invoiceId: string): Promise<Document[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    where("invoiceId", "==", invoiceId)
  );
  return documents.map(toDocument).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get documents by uploader
export async function getDocumentsByUploader(userId: string): Promise<Document[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const documents = await getDocuments<FirestoreDocument>(
    COLLECTIONS.DOCUMENTS,
    where("uploadedBy", "==", userId)
  );
  return documents.map(toDocument).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Create document (file URL is optional)
export async function createDocumentRecord(
  data: Omit<Document, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument(COLLECTIONS.DOCUMENTS, {
    name: data.name,
    type: data.type,
    uploadedBy: data.uploadedBy,
    // All these fields are optional
    fileUrl: data.fileUrl || null,
    fileSize: data.fileSize || null,
    mimeType: data.mimeType || null,
    projectId: data.projectId || null,
    clientId: data.clientId || null,
    invoiceId: data.invoiceId || null,
    description: data.description || null,
    tags: data.tags || [],
  });
}

// Update document
export async function updateDocumentRecord(
  documentId: string,
  data: Partial<Omit<Document, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.DOCUMENTS, documentId, data);
}

// Delete document
export async function deleteDocumentRecord(documentId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.DOCUMENTS, documentId);
}

// Add file to existing document record
export async function attachFileToDocument(
  documentId: string,
  fileData: {
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
  }
): Promise<void> {
  await updateDocument(COLLECTIONS.DOCUMENTS, documentId, {
    fileUrl: fileData.fileUrl,
    fileSize: fileData.fileSize || null,
    mimeType: fileData.mimeType || null,
  });
}

// Remove file from document (keeps the record)
export async function removeFileFromDocument(documentId: string): Promise<void> {
  await updateDocument(COLLECTIONS.DOCUMENTS, documentId, {
    fileUrl: null,
    fileSize: null,
    mimeType: null,
  });
}

// Search documents by name or description
export async function searchDocuments(searchTerm: string): Promise<Document[]> {
  const allDocuments = await getAllDocuments();
  const term = searchTerm.toLowerCase();

  return allDocuments.filter(
    (doc) =>
      doc.name.toLowerCase().includes(term) ||
      (doc.description && doc.description.toLowerCase().includes(term)) ||
      (doc.tags && doc.tags.some((tag) => tag.toLowerCase().includes(term)))
  );
}

// Get documents with files attached
export async function getDocumentsWithFiles(): Promise<Document[]> {
  const allDocuments = await getAllDocuments();
  return allDocuments.filter((doc) => doc.fileUrl);
}

// Get documents without files (records only)
export async function getDocumentsWithoutFiles(): Promise<Document[]> {
  const allDocuments = await getAllDocuments();
  return allDocuments.filter((doc) => !doc.fileUrl);
}

// Get document counts by type
export async function getDocumentCountsByType(): Promise<Record<DocumentType, number>> {
  const allDocuments = await getAllDocuments();

  const counts: Record<DocumentType, number> = {
    CONTRACT: 0,
    PROPOSAL: 0,
    INVOICE: 0,
    RECEIPT: 0,
    REPORT: 0,
    OTHER: 0,
  };

  allDocuments.forEach((doc) => {
    counts[doc.type]++;
  });

  return counts;
}
