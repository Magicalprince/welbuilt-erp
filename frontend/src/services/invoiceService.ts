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
import type { Invoice, InvoiceLineItem, InvoicePayment, InvoiceStatus } from "@/types";

export interface FirestoreInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  issueDate: Timestamp;
  dueDate: Timestamp;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestorePayment {
  id: string;
  invoiceId: string;
  description: string;
  amount: number;
  dueDate: Timestamp;
  paidDate?: Timestamp;
  status: "PENDING" | "PAID" | "OVERDUE";
  paymentMethod?: string;
  createdAt: Timestamp;
}

// Convert Firestore invoice to Invoice type
function toInvoice(doc: FirestoreInvoice, payments: InvoicePayment[] = []): Invoice {
  return {
    ...doc,
    issueDate: doc.issueDate.toDate(),
    dueDate: doc.dueDate.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
    payments,
  };
}

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    orderBy("createdAt", "desc")
  );
  const lastNumber = invoices.length > 0
    ? parseInt(invoices[0].invoiceNumber.replace("INV-", ""), 10)
    : 0;
  return `INV-${String(lastNumber + 1).padStart(3, "0")}`;
}

// Get invoice by ID with payments
export async function getInvoiceById(invoiceId: string): Promise<Invoice | null> {
  const invoice = await getDocument<FirestoreInvoice>(COLLECTIONS.INVOICES, invoiceId);
  if (!invoice) return null;

  const payments = await getInvoicePayments(invoiceId);
  return toInvoice(invoice, payments);
}

// Get all invoices
export async function getAllInvoices(): Promise<Invoice[]> {
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    orderBy("createdAt", "desc")
  );

  return Promise.all(
    invoices.map(async (invoice) => {
      const payments = await getInvoicePayments(invoice.id);
      return toInvoice(invoice, payments);
    })
  );
}

// Get invoices by client
export async function getInvoicesByClient(clientId: string): Promise<Invoice[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    where("clientId", "==", clientId)
  );

  const results = await Promise.all(
    invoices.map(async (invoice) => {
      const payments = await getInvoicePayments(invoice.id);
      return toInvoice(invoice, payments);
    })
  );

  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get invoices by project
export async function getInvoicesByProject(projectId: string): Promise<Invoice[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    where("projectId", "==", projectId)
  );

  const results = await Promise.all(
    invoices.map(async (invoice) => {
      const payments = await getInvoicePayments(invoice.id);
      return toInvoice(invoice, payments);
    })
  );

  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get invoices by status
export async function getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    where("status", "==", status)
  );

  const results = await Promise.all(
    invoices.map(async (invoice) => {
      const payments = await getInvoicePayments(invoice.id);
      return toInvoice(invoice, payments);
    })
  );

  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Get pending payments total
export async function getPendingPaymentsTotal(): Promise<number> {
  const invoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    where("status", "in", ["PENDING", "PARTIAL", "OVERDUE"])
  );
  return invoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0);
}

// Create invoice with payment schedule
export async function createInvoice(
  data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt" | "payments" | "paidAmount">,
  paymentSchedule: { description: string; amount: number; dueDate: Date }[] = []
): Promise<string> {
  const batch = writeBatch(db);
  const invoiceNumber = await generateInvoiceNumber();

  // Create invoice document
  const invoiceRef = doc(collection(db, COLLECTIONS.INVOICES));
  batch.set(invoiceRef, {
    ...stripUndefined(data as unknown as Record<string, unknown>),
    invoiceNumber,
    issueDate: Timestamp.fromDate(data.issueDate),
    dueDate: Timestamp.fromDate(data.dueDate),
    paidAmount: 0,
    status: "PENDING",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Create payment schedule entries
  paymentSchedule.forEach((payment) => {
    const paymentRef = doc(collection(db, COLLECTIONS.INVOICE_PAYMENTS));
    batch.set(paymentRef, stripUndefined({
      invoiceId: invoiceRef.id,
      description: payment.description,
      amount: payment.amount,
      dueDate: Timestamp.fromDate(payment.dueDate),
      status: "PENDING",
      createdAt: Timestamp.now(),
    }));
  });

  await batch.commit();
  return invoiceRef.id;
}

// Update invoice. GST percent/amount fields additionally accept `null` (on
// top of Invoice's own `number | undefined`) so a caller can explicitly
// clear them when the invoice's GST type changes to one that no longer uses
// them — `undefined` fields get stripped by updateDocument() before reaching
// Firestore and wouldn't clear anything, only `null` actually does.
export async function updateInvoice(
  invoiceId: string,
  data: Partial<
    Omit<
      Invoice,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "payments"
      | "cgstPercent"
      | "sgstPercent"
      | "igstPercent"
      | "cgstAmount"
      | "sgstAmount"
      | "igstAmount"
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
  if (data.dueDate) updateData.dueDate = Timestamp.fromDate(data.dueDate);

  await updateDocument(COLLECTIONS.INVOICES, invoiceId, updateData);
}

// Delete invoice (also deletes payments)
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, COLLECTIONS.INVOICES, invoiceId));

  const payments = await getDocuments<FirestorePayment>(
    COLLECTIONS.INVOICE_PAYMENTS,
    where("invoiceId", "==", invoiceId)
  );
  payments.forEach((payment) => {
    batch.delete(doc(db, COLLECTIONS.INVOICE_PAYMENTS, payment.id));
  });

  await batch.commit();
}

// Get invoice payments
export async function getInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  // Fetch without orderBy to avoid composite index, sort in-memory
  const payments = await getDocuments<FirestorePayment>(
    COLLECTIONS.INVOICE_PAYMENTS,
    where("invoiceId", "==", invoiceId)
  );

  return payments
    .map((payment) => ({
      ...payment,
      dueDate: payment.dueDate.toDate(),
      paidDate: payment.paidDate?.toDate(),
      createdAt: payment.createdAt.toDate(),
    }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// Record payment (mark as paid)
export async function recordPayment(
  paymentId: string,
  paymentMethod: string
): Promise<void> {
  // Update payment record
  await updateDocument(COLLECTIONS.INVOICE_PAYMENTS, paymentId, {
    status: "PAID",
    paidDate: Timestamp.now(),
    paymentMethod,
  });

  // Get payment to find invoice
  const payment = await getDocument<FirestorePayment>(COLLECTIONS.INVOICE_PAYMENTS, paymentId);
  if (!payment) return;

  // Update invoice paid amount and status
  const invoice = await getDocument<FirestoreInvoice>(COLLECTIONS.INVOICES, payment.invoiceId);
  if (!invoice) return;

  const newPaidAmount = invoice.paidAmount + payment.amount;
  let newStatus: InvoiceStatus = "PARTIAL";

  if (newPaidAmount >= invoice.total) {
    newStatus = "PAID";
  } else if (newPaidAmount > 0) {
    newStatus = "PARTIAL";
  }

  await updateDocument(COLLECTIONS.INVOICES, payment.invoiceId, {
    paidAmount: newPaidAmount,
    status: newStatus,
  });
}

// Add payment to invoice schedule
export async function addPaymentToSchedule(
  invoiceId: string,
  data: { description: string; amount: number; dueDate: Date }
): Promise<string> {
  const paymentRef = doc(collection(db, COLLECTIONS.INVOICE_PAYMENTS));
  const batch = writeBatch(db);

  batch.set(paymentRef, stripUndefined({
    invoiceId,
    description: data.description,
    amount: data.amount,
    dueDate: Timestamp.fromDate(data.dueDate),
    status: "PENDING",
    createdAt: Timestamp.now(),
  }));

  await batch.commit();
  return paymentRef.id;
}

// Check and update overdue invoices
export async function updateOverdueInvoices(): Promise<void> {
  const now = new Date();
  const pendingInvoices = await getDocuments<FirestoreInvoice>(
    COLLECTIONS.INVOICES,
    where("status", "in", ["PENDING", "PARTIAL"])
  );

  const batch = writeBatch(db);
  let hasUpdates = false;

  for (const invoice of pendingInvoices) {
    if (invoice.dueDate.toDate() < now) {
      batch.update(doc(db, COLLECTIONS.INVOICES, invoice.id), { status: "OVERDUE" });
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }
}
