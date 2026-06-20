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
import type { Quotation, QuotationStatus, QuotationLineItem } from "@/types";

export interface FirestoreQuotation {
  id: string;
  quotationNumber: string;
  clientId: string;
  projectId?: string;
  issueDate: Timestamp;
  validUntil: Timestamp;
  lineItems: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: QuotationStatus;
  notes?: string;
  terms?: string;
  gstType?: string;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  convertedToInvoiceId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toQuotation(doc: FirestoreQuotation): Quotation {
  return {
    ...doc,
    issueDate: doc.issueDate.toDate(),
    validUntil: doc.validUntil.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    gstType: doc.gstType as Quotation["gstType"],
  };
}

async function generateQuotationNumber(): Promise<string> {
  const quotations = await getDocuments<FirestoreQuotation>(
    COLLECTIONS.QUOTATIONS,
    orderBy("createdAt", "desc")
  );
  const lastNumber =
    quotations.length > 0
      ? parseInt(quotations[0].quotationNumber.replace("QUO-", ""), 10)
      : 0;
  return `QUO-${String(lastNumber + 1).padStart(3, "0")}`;
}

export async function getQuotationById(quotationId: string): Promise<Quotation | null> {
  const quotation = await getDocument<FirestoreQuotation>(COLLECTIONS.QUOTATIONS, quotationId);
  if (!quotation) return null;
  return toQuotation(quotation);
}

export async function getAllQuotations(): Promise<Quotation[]> {
  const quotations = await getDocuments<FirestoreQuotation>(
    COLLECTIONS.QUOTATIONS,
    orderBy("createdAt", "desc")
  );
  return quotations.map(toQuotation);
}

export async function getQuotationsByClient(clientId: string): Promise<Quotation[]> {
  const quotations = await getDocuments<FirestoreQuotation>(
    COLLECTIONS.QUOTATIONS,
    where("clientId", "==", clientId)
  );
  return quotations.map(toQuotation).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getQuotationsByStatus(status: QuotationStatus): Promise<Quotation[]> {
  const quotations = await getDocuments<FirestoreQuotation>(
    COLLECTIONS.QUOTATIONS,
    where("status", "==", status)
  );
  return quotations.map(toQuotation).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createQuotation(
  data: Omit<Quotation, "id" | "quotationNumber" | "createdAt" | "updatedAt">
): Promise<string> {
  const quotationNumber = await generateQuotationNumber();
  return createDocument(COLLECTIONS.QUOTATIONS, {
    ...data,
    quotationNumber,
    issueDate: Timestamp.fromDate(data.issueDate),
    validUntil: Timestamp.fromDate(data.validUntil),
  });
}

export async function updateQuotation(
  quotationId: string,
  data: Partial<Omit<Quotation, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.issueDate) updateData.issueDate = Timestamp.fromDate(data.issueDate);
  if (data.validUntil) updateData.validUntil = Timestamp.fromDate(data.validUntil);
  await updateDocument(COLLECTIONS.QUOTATIONS, quotationId, updateData);
}

export async function deleteQuotation(quotationId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.QUOTATIONS, quotationId);
}

export async function convertQuotationToInvoice(quotationId: string, invoiceId: string): Promise<void> {
  await updateDocument(COLLECTIONS.QUOTATIONS, quotationId, {
    status: "ACCEPTED" as QuotationStatus,
    convertedToInvoiceId: invoiceId,
  });
}
