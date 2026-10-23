import { Timestamp, writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  updateDocument,
  orderBy,
  stripUndefined,
} from "./firestore";
import { createInvoice } from "./invoiceService";
import type { RecurringInvoiceTemplate, RecurringFrequency, InvoiceLineItem, GSTType } from "@/types";

export interface FirestoreRecurringTemplate {
  id: string;
  templateName: string;
  clientId: string;
  projectId?: string;
  lineItems: InvoiceLineItem[];
  discount: number;
  gstType?: GSTType;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  notes?: string;
  brand?: "welbuilt" | "sparks";
  frequency: RecurringFrequency;
  billingDay: number;
  isActive: boolean;
  lastGeneratedPeriod?: string;
  lastGeneratedInvoiceId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toTemplate(doc: FirestoreRecurringTemplate): RecurringInvoiceTemplate {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getTemplateById(templateId: string): Promise<RecurringInvoiceTemplate | null> {
  const template = await getDocument<FirestoreRecurringTemplate>(COLLECTIONS.RECURRING_INVOICE_TEMPLATES, templateId);
  return template ? toTemplate(template) : null;
}

export async function getAllTemplates(): Promise<RecurringInvoiceTemplate[]> {
  const templates = await getDocuments<FirestoreRecurringTemplate>(
    COLLECTIONS.RECURRING_INVOICE_TEMPLATES,
    orderBy("createdAt", "desc")
  );
  return templates.map(toTemplate);
}

export async function createTemplate(
  data: Omit<RecurringInvoiceTemplate, "id" | "createdAt" | "updatedAt" | "lastGeneratedPeriod" | "lastGeneratedInvoiceId">
): Promise<string> {
  const templateRef = doc(collection(db, COLLECTIONS.RECURRING_INVOICE_TEMPLATES));
  const batch = writeBatch(db);

  batch.set(templateRef, {
    ...stripUndefined(data as unknown as Record<string, unknown>),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await batch.commit();
  return templateRef.id;
}

export async function updateTemplate(
  templateId: string,
  data: Partial<Omit<RecurringInvoiceTemplate, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.RECURRING_INVOICE_TEMPLATES, templateId, data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.RECURRING_INVOICE_TEMPLATES, templateId));
  await batch.commit();
}

// yyyy-MM, matching lastGeneratedPeriod's stored format.
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Pure function, no Firestore call — runs client-side against an
// already-fetched template list so the "due this month" banner needs no
// extra query. A template is due once its billing day has passed (or
// arrived) this month and it hasn't already been generated this period.
export function getDueTemplates(templates: RecurringInvoiceTemplate[]): RecurringInvoiceTemplate[] {
  const period = currentPeriod();
  const today = new Date().getDate();
  return templates.filter(
    (t) => t.isActive && t.lastGeneratedPeriod !== period && today >= t.billingDay
  );
}

// Computes subtotal/GST/total from the template's line items (same math
// InvoiceFormPage uses), materializes a real Tax Invoice via
// createInvoice() — the one correct write path — then stamps the
// template with the period it was generated for, so a second click of
// "Generate Due" this same month is a no-op for this template.
export async function generateInvoiceFromTemplate(template: RecurringInvoiceTemplate): Promise<string> {
  const subtotal = template.lineItems.reduce((sum, item) => sum + item.amount, 0);

  const cgstAmount = template.gstType === "CGST_SGST" ? (subtotal * (template.cgstPercent ?? 0)) / 100 : 0;
  const sgstAmount = template.gstType === "CGST_SGST" ? (subtotal * (template.sgstPercent ?? 0)) / 100 : 0;
  const igstAmount = template.gstType === "IGST" ? (subtotal * (template.igstPercent ?? 0)) / 100 : 0;
  const tax = cgstAmount + sgstAmount + igstAmount;
  const total = subtotal + tax - template.discount;

  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceId = await createInvoice({
    clientId: template.clientId,
    projectId: template.projectId,
    issueDate,
    dueDate,
    lineItems: template.lineItems,
    subtotal,
    tax,
    discount: template.discount,
    total,
    status: "PENDING",
    notes: template.notes,
    brand: template.brand,
    gstType: template.gstType,
    ...(template.gstType === "CGST_SGST" && {
      cgstPercent: template.cgstPercent,
      sgstPercent: template.sgstPercent,
      cgstAmount,
      sgstAmount,
    }),
    ...(template.gstType === "IGST" && {
      igstPercent: template.igstPercent,
      igstAmount,
    }),
  });

  await updateTemplate(template.id, {
    lastGeneratedPeriod: currentPeriod(),
    lastGeneratedInvoiceId: invoiceId,
  });

  return invoiceId;
}
