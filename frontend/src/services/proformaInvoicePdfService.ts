import { saveAs } from "file-saver";
import type { ProformaInvoice, Client, Invoice } from "@/types";
import { generateInvoicePdf } from "./invoicePdfService";
import { getCompanySettings } from "./settingsService";

// Thin adapter, not a second ~400-line PDF layout implementation.
// generateInvoicePdf() only ever reads brand/invoiceNumber/issueDate/
// lineItems/gstType/cgst-sgst-igst percent+amount/discount/total/
// subtotal off the Invoice it's given — never dueDate, status, notes,
// payments, or paidAmount — so a ProformaInvoice (deliberately shaped
// to mirror Invoice's field names) maps across directly. Reusing the
// drawing function means every future invoice-PDF layout fix also
// applies to proformas for free, instead of needing to be re-applied to
// a forked copy.
function toInvoiceShape(proforma: ProformaInvoice): Invoice {
  return {
    ...proforma,
    invoiceNumber: proforma.proformaNumber,
    dueDate: proforma.validUntil ?? proforma.issueDate,
    tax: (proforma.cgstAmount ?? 0) + (proforma.sgstAmount ?? 0) + (proforma.igstAmount ?? 0),
    paidAmount: 0,
    status: "DRAFT",
    payments: [],
  };
}

export async function generateProformaPdfBlob(proforma: ProformaInvoice, client: Client): Promise<Blob> {
  const companySettings = await getCompanySettings();
  const pdfBytes = await generateInvoicePdf(toInvoiceShape(proforma), client, null, companySettings, "Proforma Invoice");
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export async function generateProformaPdfUrl(proforma: ProformaInvoice, client: Client): Promise<string> {
  const blob = await generateProformaPdfBlob(proforma, client);
  return URL.createObjectURL(blob);
}

export async function generateAndDownloadProformaPdf(proforma: ProformaInvoice, client: Client): Promise<void> {
  const blob = await generateProformaPdfBlob(proforma, client);
  saveAs(blob, `${proforma.proformaNumber}_${client.companyName.replace(/\s+/g, "_")}.pdf`);
}
