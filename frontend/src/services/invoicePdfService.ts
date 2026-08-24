import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Invoice, Client, Project, CompanySettings } from "@/types";
import { getCompanySettings } from "./settingsService";

// ── Brand identity blocks ────────────────────────────────────────────────────
// Invoices are issued either as Sparks AI (software solutions — the default,
// per explicit business decision) or WelBuilt AI Solutions directly. Each
// brand carries its own name/tagline/address, matching the split already
// established for offer letters (sparksOfferLetterService.ts vs
// offerLetterService.ts) — WelBuilt AI Solutions is always credited as the
// parent company in the footer regardless of which brand issued the document.

interface BrandIdentity {
  name: string;
  tagline: string;
  addressLines: string[];
  logoPath: string;
  footerNote: string;
}

const BRANDS: Record<"welbuilt" | "sparks", BrandIdentity> = {
  sparks: {
    name: "SPARKS AI SOLUTIONS",
    tagline: "Software Solutions & AI Products",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street, Tiruvannamalai",
      "Tamil Nadu - 606601  |  sparksai.solutions",
    ],
    logoPath: "/images/sparks/logo.png",
    footerNote: "Sparks AI Solutions is a brand under WelBuilt AI Solutions Pvt. Ltd.",
  },
  welbuilt: {
    name: "WELBUILT AI SOLUTIONS",
    tagline: "AI-Powered Software Solutions",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street, Tiruvannamalai",
      "Tamil Nadu - 606601  |  welbuilt.ai",
    ],
    logoPath: "/images/logo-full.png",
    footerNote: "WelBuilt AI Solutions Pvt. Ltd.",
  },
};

// ── Design tokens — modern 2026 palette: deep indigo + warm gold ───────────
const COLORS = {
  ink: rgb(0.09, 0.09, 0.12),
  slate: rgb(0.42, 0.44, 0.5),
  faint: rgb(0.62, 0.64, 0.69),
  indigo: rgb(0.192, 0.204, 0.396),   // #313468 header/accents
  indigoLight: rgb(0.94, 0.945, 0.97),
  gold: rgb(0.784, 0.647, 0.078),     // #C8A514
  white: rgb(1, 1, 1),
  line: rgb(0.88, 0.89, 0.91),
  success: rgb(0.1, 0.5, 0.3),
  danger: rgb(0.75, 0.2, 0.2),
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatLong(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatMoney(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function wrapText(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const STATUS_LABEL: Record<Invoice["status"], string> = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PAID: "PAID",
  PARTIAL: "PARTIALLY PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
};

// ── Core PDF generator ───────────────────────────────────────────────────────

export async function generateInvoicePdf(
  invoice: Invoice,
  client: Client,
  project: Project | null,
  companySettings: CompanySettings,
): Promise<Uint8Array> {
  const brand = BRANDS[invoice.brand ?? "sparks"];

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const W = 595.28;
  const H = 841.89;

  const [regularBytes, boldBytes] = await Promise.all([
    fetchBytes("/fonts/Poppins-Regular.ttf"),
    fetchBytes("/fonts/Poppins-Bold.ttf"),
  ]);
  let regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  try {
    if (regularBytes) regular = await pdfDoc.embedFont(regularBytes);
    if (boldBytes) bold = await pdfDoc.embedFont(boldBytes);
  } catch {
    /* fall back to Helvetica already assigned above */
  }

  const logoBytes = await fetchBytes(brand.logoPath);
  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null;

  const MARGIN = 42;
  const CW = W - MARGIN * 2;

  let page = pdfDoc.addPage([W, H]);
  let Y = H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    Y = H - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (Y - needed < 70) newPage();
  };

  // ── Header band ─────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 118, width: W, height: 118, color: COLORS.indigo });
  page.drawRectangle({ x: 0, y: H - 122, width: W, height: 4, color: COLORS.gold });

  if (logoImg) {
    const dims = logoImg.scale(0.22);
    page.drawImage(logoImg, { x: MARGIN, y: H - 40 - dims.height, width: dims.width, height: dims.height });
  }

  page.drawText(brand.name, { x: MARGIN, y: H - 34, size: 16, font: bold, color: COLORS.white });
  page.drawText(brand.tagline, { x: MARGIN, y: H - 50, size: 8.5, font: regular, color: COLORS.white, opacity: 0.85 });
  brand.addressLines.forEach((line, i) => {
    page.drawText(line, { x: MARGIN, y: H - 64 - i * 11, size: 7.5, font: regular, color: COLORS.white, opacity: 0.75 });
  });

  const title = "TAX INVOICE";
  const titleSize = 22;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: W - MARGIN - titleW, y: H - 42, size: titleSize, font: bold, color: COLORS.white });

  const invNoText = `# ${invoice.invoiceNumber}`;
  const invNoW = regular.widthOfTextAtSize(invNoText, 10);
  page.drawText(invNoText, { x: W - MARGIN - invNoW, y: H - 62, size: 10, font: regular, color: COLORS.gold });

  const statusText = STATUS_LABEL[invoice.status];
  const statusColor = invoice.status === "PAID" ? COLORS.success : invoice.status === "OVERDUE" ? COLORS.danger : COLORS.white;
  const statusW = bold.widthOfTextAtSize(statusText, 9);
  page.drawRectangle({
    x: W - MARGIN - statusW - 16, y: H - 84, width: statusW + 16, height: 16,
    color: COLORS.white, opacity: 0.12,
  });
  page.drawText(statusText, { x: W - MARGIN - statusW - 8, y: H - 80, size: 9, font: bold, color: statusColor === COLORS.white ? COLORS.white : statusColor });

  Y = H - 118 - 30;

  // ── Bill To / Invoice meta two-column block ───────────────────────────────
  const colGap = 24;
  const colW = (CW - colGap) / 2;

  page.drawText("BILL TO", { x: MARGIN, y: Y, size: 8, font: bold, color: COLORS.gold });
  let leftY = Y - 16;
  page.drawText(client.companyName, { x: MARGIN, y: leftY, size: 12, font: bold, color: COLORS.ink });
  leftY -= 15;
  page.drawText(client.contactPerson, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
  leftY -= 13;
  if (client.address) {
    for (const line of wrapText(client.address, regular, 9, colW)) {
      page.drawText(line, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
      leftY -= 12;
    }
  }
  page.drawText(client.email, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
  leftY -= 12;
  if (client.phone) {
    page.drawText(client.phone, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
    leftY -= 12;
  }
  if (client.gstNumber) {
    page.drawText(`GSTIN: ${client.gstNumber}`, { x: MARGIN, y: leftY, size: 9, font: bold, color: COLORS.ink });
    leftY -= 12;
  }

  const rightX = MARGIN + colW + colGap;
  let rightY = Y;
  const metaRow = (label: string, value: string) => {
    page.drawText(label, { x: rightX, y: rightY, size: 8.5, font: regular, color: COLORS.slate });
    const vW = bold.widthOfTextAtSize(value, 9.5);
    page.drawText(value, { x: rightX + colW - vW, y: rightY, size: 9.5, font: bold, color: COLORS.ink });
    rightY -= 17;
  };
  metaRow("Issue Date", formatLong(invoice.issueDate));
  metaRow("Due Date", formatLong(invoice.dueDate));
  if (project) metaRow("Project", project.title);
  if (companySettings.gstNumber) metaRow("Seller GSTIN", companySettings.gstNumber);
  if (invoice.gstType && invoice.gstType !== "NONE") {
    metaRow("Supply Type", invoice.gstType === "IGST" ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)");
  }

  Y = Math.min(leftY, rightY) - 20;

  // ── Line items table ───────────────────────────────────────────────────
  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: Y - 22, width: CW, height: 24, color: COLORS.indigoLight });
    page.drawText("DESCRIPTION", { x: MARGIN + 8, y: Y - 15, size: 8, font: bold, color: COLORS.indigo });
    page.drawText("QTY", { x: MARGIN + CW - 200, y: Y - 15, size: 8, font: bold, color: COLORS.indigo });
    page.drawText("RATE", { x: MARGIN + CW - 150, y: Y - 15, size: 8, font: bold, color: COLORS.indigo });
    page.drawText("AMOUNT", { x: MARGIN + CW - 70, y: Y - 15, size: 8, font: bold, color: COLORS.indigo });
    Y -= 30;
  };

  ensureSpace(60);
  drawTableHeader();

  for (const item of invoice.lineItems) {
    const descLines = wrapText(item.description, regular, 9.5, CW - 210);
    const rowH = Math.max(18, descLines.length * 12 + 6);
    ensureSpace(rowH + 10);
    if (Y - rowH < 70) {
      newPage();
      drawTableHeader();
    }
    descLines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 8, y: Y - 12 - i * 12, size: 9.5, font: regular, color: COLORS.ink });
    });
    const qtyText = String(item.quantity);
    const rateText = formatMoney(item.rate);
    const amtText = formatMoney(item.amount);
    page.drawText(qtyText, { x: MARGIN + CW - 200, y: Y - 12, size: 9.5, font: regular, color: COLORS.slate });
    const rateW = regular.widthOfTextAtSize(rateText, 9.5);
    page.drawText(rateText, { x: MARGIN + CW - 90 - rateW, y: Y - 12, size: 9.5, font: regular, color: COLORS.slate });
    const amtW = bold.widthOfTextAtSize(amtText, 9.5);
    page.drawText(amtText, { x: MARGIN + CW - amtW, y: Y - 12, size: 9.5, font: bold, color: COLORS.ink });
    Y -= rowH;
    page.drawRectangle({ x: MARGIN, y: Y, width: CW, height: 0.5, color: COLORS.line });
  }

  Y -= 14;
  ensureSpace(140);

  // ── Totals block ───────────────────────────────────────────────────────
  const totalsX = MARGIN + CW - 220;
  const totalsW = 220;
  const totalRow = (label: string, value: string, opts?: { bold?: boolean; muted?: boolean }) => {
    const font = opts?.bold ? bold : regular;
    const color = opts?.muted ? COLORS.slate : COLORS.ink;
    page.drawText(label, { x: totalsX, y: Y, size: opts?.bold ? 10.5 : 9, font, color });
    const vW = font.widthOfTextAtSize(value, opts?.bold ? 10.5 : 9);
    page.drawText(value, { x: totalsX + totalsW - vW, y: Y, size: opts?.bold ? 10.5 : 9, font, color: opts?.bold ? COLORS.indigo : color });
    Y -= 16;
  };

  totalRow("Subtotal", formatMoney(invoice.subtotal));

  if (invoice.gstType === "CGST_SGST") {
    totalRow(`CGST (${invoice.cgstPercent ?? 0}%)`, formatMoney(invoice.cgstAmount ?? 0), { muted: true });
    totalRow(`SGST (${invoice.sgstPercent ?? 0}%)`, formatMoney(invoice.sgstAmount ?? 0), { muted: true });
  } else if (invoice.gstType === "IGST") {
    totalRow(`IGST (${invoice.igstPercent ?? 0}%)`, formatMoney(invoice.igstAmount ?? 0), { muted: true });
  } else if (invoice.tax > 0) {
    totalRow("Tax", formatMoney(invoice.tax), { muted: true });
  }

  if (invoice.discount > 0) {
    totalRow("Discount", `- ${formatMoney(invoice.discount)}`, { muted: true });
  }

  page.drawRectangle({ x: totalsX, y: Y + 4, width: totalsW, height: 0.75, color: COLORS.line });
  Y -= 6;
  page.drawRectangle({ x: totalsX - 10, y: Y - 6, width: totalsW + 10, height: 26, color: COLORS.indigo });
  page.drawText("TOTAL DUE", { x: totalsX, y: Y + 3, size: 10, font: bold, color: COLORS.white });
  const totalText = formatMoney(invoice.total);
  const totalW = bold.widthOfTextAtSize(totalText, 13);
  page.drawText(totalText, { x: totalsX + totalsW - totalW, y: Y + 2, size: 13, font: bold, color: COLORS.gold });
  Y -= 30;

  if (invoice.paidAmount > 0) {
    totalRow("Paid", formatMoney(invoice.paidAmount), { muted: true });
    totalRow("Balance Due", formatMoney(invoice.total - invoice.paidAmount), { bold: true });
  }

  Y -= 10;

  // ── Bank details ───────────────────────────────────────────────────────
  if (companySettings.bankDetails) {
    ensureSpace(90);
    page.drawText("PAYMENT DETAILS", { x: MARGIN, y: Y, size: 8.5, font: bold, color: COLORS.gold });
    Y -= 16;
    const bd = companySettings.bankDetails;
    const bankLines = [
      `Account Holder: ${bd.accountHolderName}`,
      `Bank: ${bd.bankName}`,
      `Account No: ${bd.accountNumber}`,
      `IFSC: ${bd.ifscCode}`,
    ];
    for (const line of bankLines) {
      page.drawText(line, { x: MARGIN, y: Y, size: 9, font: regular, color: COLORS.slate });
      Y -= 13;
    }
    Y -= 6;
  }

  // ── Notes ───────────────────────────────────────────────────────────────
  if (invoice.notes) {
    ensureSpace(50);
    page.drawText("NOTES", { x: MARGIN, y: Y, size: 8.5, font: bold, color: COLORS.gold });
    Y -= 15;
    for (const line of wrapText(invoice.notes, regular, 9, CW)) {
      ensureSpace(14);
      page.drawText(line, { x: MARGIN, y: Y, size: 9, font: regular, color: COLORS.slate });
      Y -= 13;
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    const footerY = 34;
    p.drawRectangle({ x: MARGIN, y: footerY + 8, width: W - MARGIN * 2, height: 0.75, color: COLORS.line });
    p.drawText(brand.footerNote, { x: MARGIN, y: footerY - 4, size: 7, font: regular, color: COLORS.faint });
    const pageNoText = `Page ${idx + 1} of ${pages.length}`;
    const pageNoW = regular.widthOfTextAtSize(pageNoText, 7);
    p.drawText(pageNoText, { x: W - MARGIN - pageNoW, y: footerY - 4, size: 7, font: regular, color: COLORS.faint });
  });

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────────

export async function generateAndDownloadInvoicePdf(
  invoice: Invoice,
  client: Client,
  project: Project | null,
): Promise<void> {
  const companySettings = await getCompanySettings();
  const pdfBytes = await generateInvoicePdf(invoice, client, project, companySettings);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, `${invoice.invoiceNumber}_${client.companyName.replace(/\s+/g, "_")}.pdf`);
}
