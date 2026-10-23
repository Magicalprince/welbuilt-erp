import { Timestamp, writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  updateDocument,
  orderBy,
  where,
  stripUndefined,
} from "./firestore";
import { createInvoice } from "./invoiceService";
import type { ProformaInvoice, ProformaStatus, InvoiceLineItem, GSTType } from "@/types";

export interface FirestoreProforma {
  id: string;
  proformaNumber: string;
  clientId: string;
  projectId?: string;
  issueDate: Timestamp;
  validUntil?: Timestamp;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: ProformaStatus;
  notes?: string;
  brand?: "welbuilt" | "sparks";
  gstType?: GSTType;
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

function toProforma(doc: FirestoreProforma): ProformaInvoice {
  return {
    ...doc,
    issueDate: doc.issueDate.toDate(),
    validUntil: doc.validUntil?.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

// Same scan-and-increment pattern as generateInvoiceNumber()/
// generateQuotationNumber() — not atomic, but matches the established
// per-document-type convention rather than introducing a shared counter.
async function generateProformaNumber(): Promise<string> {
  const proformas = await getDocuments<FirestoreProforma>(
    COLLECTIONS.PROFORMA_INVOICES,
    orderBy("createdAt", "desc")
  );
  const lastNumber = proformas.length > 0
    ? parseInt(proformas[0].proformaNumber.replace("PRO-", ""), 10)
    : 0;
  return `PRO-${String(lastNumber + 1).padStart(3, "0")}`;
}

export async function getProformaById(proformaId: string): Promise<ProformaInvoice | null> {
  const proforma = await getDocument<FirestoreProforma>(COLLECTIONS.PROFORMA_INVOICES, proformaId);
  return proforma ? toProforma(proforma) : null;
}

export async function getAllProformas(): Promise<ProformaInvoice[]> {
  const proformas = await getDocuments<FirestoreProforma>(
    COLLECTIONS.PROFORMA_INVOICES,
    orderBy("createdAt", "desc")
  );
  return proformas.map(toProforma);
}

export async function getProformasByClient(clientId: string): Promise<ProformaInvoice[]> {
  const proformas = await getDocuments<FirestoreProforma>(
    COLLECTIONS.PROFORMA_INVOICES,
    where("clientId", "==", clientId)
  );
  return proformas.map(toProforma).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createProforma(
  data: Omit<ProformaInvoice, "id" | "proformaNumber" | "createdAt" | "updatedAt" | "convertedToInvoiceId">
): Promise<string> {
  const batch = writeBatch(db);
  const proformaNumber = await generateProformaNumber();

  const proformaRef = doc(collection(db, COLLECTIONS.PROFORMA_INVOICES));
  batch.set(proformaRef, {
    ...stripUndefined(data as unknown as Record<string, unknown>),
    proformaNumber,
    issueDate: Timestamp.fromDate(data.issueDate),
    validUntil: data.validUntil ? Timestamp.fromDate(data.validUntil) : undefined,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await batch.commit();
  return proformaRef.id;
}

// Same null-vs-undefined GST-field contract as updateInvoice(): undefined
// is stripped before reaching Firestore, only null actually clears a field.
export async function updateProforma(
  proformaId: string,
  data: Partial<
    Omit<
      ProformaInvoice,
      "id" | "createdAt" | "updatedAt" | "cgstPercent" | "sgstPercent" | "igstPercent" | "cgstAmount" | "sgstAmount" | "igstAmount"
    >
  > & {
    cgstPercent?: number | null;
    sgstPercent?: number | null;
    igstPercent?: number | null;
    cgstAmount?: number | null;
    sgstAmount?: number | null;
    igstAmount?: number | null;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.issueDate) updateData.issueDate = Timestamp.fromDate(data.issueDate);
  if (data.validUntil) updateData.validUntil = Timestamp.fromDate(data.validUntil);

  await updateDocument(COLLECTIONS.PROFORMA_INVOICES, proformaId, updateData);
}

export async function deleteProforma(proformaId: string): Promise<void> {
  // No sibling collection to clean up (unlike invoices, proformas have
  // no payments sub-collection), so a plain doc delete is sufficient.
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.PROFORMA_INVOICES, proformaId));
  await batch.commit();
}

// Materializes a real Tax Invoice from a proforma's current line
// items/GST/client/project, then marks the proforma CONVERTED with a
// durable link back to the new invoice. Always goes through
// createInvoice() — the one correct write path — rather than
// hand-rolling a second numbering/batch-write implementation.
export async function convertProformaToInvoice(proformaId: string): Promise<string> {
  const proforma = await getProformaById(proformaId);
  if (!proforma) throw new Error("Proforma not found");
  if (proforma.status === "CONVERTED") {
    throw new Error("This proforma has already been converted");
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const tax = (proforma.cgstAmount ?? 0) + (proforma.sgstAmount ?? 0) + (proforma.igstAmount ?? 0);

  const invoiceId = await createInvoice({
    clientId: proforma.clientId,
    projectId: proforma.projectId,
    issueDate: new Date(),
    dueDate,
    lineItems: proforma.lineItems,
    subtotal: proforma.subtotal,
    tax,
    discount: proforma.discount,
    total: proforma.total,
    status: "PENDING",
    notes: proforma.notes,
    brand: proforma.brand,
    gstType: proforma.gstType,
    cgstPercent: proforma.cgstPercent,
    sgstPercent: proforma.sgstPercent,
    igstPercent: proforma.igstPercent,
    cgstAmount: proforma.cgstAmount,
    sgstAmount: proforma.sgstAmount,
    igstAmount: proforma.igstAmount,
  });

  await updateProforma(proformaId, { status: "CONVERTED", convertedToInvoiceId: invoiceId });

  return invoiceId;
}
