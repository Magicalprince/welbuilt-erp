import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Invoice, Client, Project, CompanySettings } from "@/types";
import { getCompanySettings } from "./settingsService";

// Invoices are issued either as Sparks AI Solutions (software solutions —
// the default) or WelBuilt AI Solutions directly. Sparks AI Solutions is
// always presented as operating under WelBuilt AI Solutions Pvt. Ltd. — not
// referred to as a "brand" anywhere in the document, per explicit request.

interface Issuer {
  name: string;
  subline: string;
  addressLines: string[];
  logoPath: string;
  footerNote: string;
}

const ISSUERS: Record<"welbuilt" | "sparks", Issuer> = {
  sparks: {
    name: "SPARKS AI SOLUTIONS",
    subline: "Software Solutions & AI Products",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street, Tiruvannamalai, Tamil Nadu - 606601",
      "sparksai.solutions",
    ],
    logoPath: "/images/sparks/logo.png",
    footerNote: "Sparks AI Solutions, under WelBuilt AI Solutions Pvt. Ltd.",
  },
  welbuilt: {
    name: "WELBUILT AI SOLUTIONS",
    subline: "AI-Powered Software Solutions",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street, Tiruvannamalai, Tamil Nadu - 606601",
      "welbuilt.ai",
    ],
    logoPath: "/images/logo-full.png",
    footerNote: "WelBuilt AI Solutions Pvt. Ltd.",
  },
};

// ── Design tokens — deep indigo + warm gold ─────────────────────────────────
const COLORS = {
  ink: rgb(0.09, 0.09, 0.12),
  slate: rgb(0.42, 0.44, 0.5),
  faint: rgb(0.62, 0.64, 0.69),
  indigo: rgb(0.192, 0.204, 0.396),
  indigoLight: rgb(0.94, 0.945, 0.97),
  gold: rgb(0.784, 0.647, 0.078),
  white: rgb(1, 1, 1),
  line: rgb(0.88, 0.89, 0.91),
  success: rgb(0.11, 0.42, 0.27),
  successBg: rgb(0.86, 0.95, 0.89),
  danger: rgb(0.62, 0.16, 0.16),
  dangerBg: rgb(0.98, 0.88, 0.88),
  neutralBg: rgb(0.90, 0.90, 0.93),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 108;

// ── Helpers ───────────────────────────────────────────────────────────────

function formatLong(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatMoney(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function statusColors(status: Invoice["status"]): { bg: ReturnType<typeof rgb>; fg: ReturnType<typeof rgb> } {
  if (status === "PAID") return { bg: COLORS.successBg, fg: COLORS.success };
  if (status === "OVERDUE" || status === "CANCELLED") return { bg: COLORS.dangerBg, fg: COLORS.danger };
  return { bg: COLORS.neutralBg, fg: COLORS.slate };
}

// ── Core PDF generator ───────────────────────────────────────────────────────

export async function generateInvoicePdf(
  invoice: Invoice,
  client: Client,
  project: Project | null,
  companySettings: CompanySettings,
): Promise<Uint8Array> {
  const issuer = ISSUERS[invoice.brand ?? "sparks"];

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

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

  const logoBytes = await fetchBytes(issuer.logoPath);
  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < 74) newPage();
  };

  const drawRightAligned = (text: string, rightX: number, yPos: number, size: number, font: import("pdf-lib").PDFFont, color: ReturnType<typeof rgb>) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y: yPos, size, font, color });
    return w;
  };

  // ── Header band ───────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: COLORS.indigo });
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 4, width: PAGE_W, height: 4, color: COLORS.gold });

  // Logo occupies a fixed square on the far left; issuer name/subline/address
  // sit in their own column to the right of it so nothing overlaps regardless
  // of the logo's native aspect ratio.
  const LOGO_BOX = 44;
  let textLeftX = MARGIN;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = Math.min(LOGO_BOX / naturalDims.width, LOGO_BOX / naturalDims.height);
    const w = naturalDims.width * scale;
    const h = naturalDims.height * scale;
    page.drawImage(logoImg, {
      x: MARGIN,
      y: PAGE_H - 30 - h,
      width: w,
      height: h,
    });
    textLeftX = MARGIN + LOGO_BOX + 12;
  }

  page.drawText(issuer.name, { x: textLeftX, y: PAGE_H - 34, size: 15, font: bold, color: COLORS.white });
  page.drawText(issuer.subline, { x: textLeftX, y: PAGE_H - 49, size: 8, font: regular, color: COLORS.white, opacity: 0.8 });
  issuer.addressLines.forEach((line, i) => {
    page.drawText(line, { x: textLeftX, y: PAGE_H - 63 - i * 11, size: 7, font: regular, color: COLORS.white, opacity: 0.65 });
  });

  // Right side: document title, invoice number, status pill — each on its
  // own row with fixed vertical spacing so nothing collides.
  const rightEdge = PAGE_W - MARGIN;
  drawRightAligned("TAX INVOICE", rightEdge, PAGE_H - 38, 19, bold, COLORS.white);
  drawRightAligned(`# ${invoice.invoiceNumber}`, rightEdge, PAGE_H - 55, 9.5, regular, COLORS.gold);

  const statusText = STATUS_LABEL[invoice.status];
  const { bg: statusBg, fg: statusFg } = statusColors(invoice.status);
  const statusSize = 8;
  const statusPadX = 8;
  const statusW = bold.widthOfTextAtSize(statusText, statusSize);
  const pillW = statusW + statusPadX * 2;
  const pillH = 16;
  const pillY = PAGE_H - 76;
  page.drawRectangle({ x: rightEdge - pillW, y: pillY, width: pillW, height: pillH, color: statusBg });
  page.drawText(statusText, { x: rightEdge - pillW + statusPadX, y: pillY + 4.5, size: statusSize, font: bold, color: statusFg });

  y = PAGE_H - HEADER_H - 28;

  // ── Bill To / Invoice meta two-column block ───────────────────────────
  const colGap = 28;
  const colW = (CONTENT_W - colGap) / 2;
  const rightColX = MARGIN + colW + colGap;

  page.drawText("BILL TO", { x: MARGIN, y, size: 8, font: bold, color: COLORS.gold });
  let leftY = y - 17;
  page.drawText(client.companyName, { x: MARGIN, y: leftY, size: 12.5, font: bold, color: COLORS.ink });
  leftY -= 16;
  if (nonEmpty(client.contactPerson)) {
    page.drawText(client.contactPerson, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
    leftY -= 13;
  }
  if (nonEmpty(client.address)) {
    for (const line of wrapText(client.address, regular, 9, colW)) {
      page.drawText(line, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
      leftY -= 12;
    }
  }
  if (nonEmpty(client.email)) {
    page.drawText(client.email, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
    leftY -= 12;
  }
  if (nonEmpty(client.phone)) {
    page.drawText(client.phone, { x: MARGIN, y: leftY, size: 9, font: regular, color: COLORS.slate });
    leftY -= 12;
  }
  if (nonEmpty(client.gstNumber)) {
    page.drawText(`GSTIN: ${client.gstNumber}`, { x: MARGIN, y: leftY, size: 9, font: bold, color: COLORS.ink });
    leftY -= 12;
  }

  const metaRows: [string, string][] = [
    ["Issue Date", formatLong(invoice.issueDate)],
    ["Due Date", formatLong(invoice.dueDate)],
  ];
  if (project) metaRows.push(["Project", project.title]);
  if (nonEmpty(companySettings.gstNumber)) metaRows.push(["Seller GSTIN", companySettings.gstNumber]);
  if (invoice.gstType && invoice.gstType !== "NONE") {
    metaRows.push(["Supply Type", invoice.gstType === "IGST" ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"]);
  }

  let rightY = y - 4;
  for (const [label, value] of metaRows) {
    page.drawText(label, { x: rightColX, y: rightY, size: 8.5, font: regular, color: COLORS.slate });
    drawRightAligned(value, rightColX + colW, rightY, 9.5, bold, COLORS.ink);
    rightY -= 17;
  }

  y = Math.min(leftY, rightY) - 22;

  // ── Line items table ────────────────────────────────────────────────────
  const colQtyX = MARGIN + CONTENT_W - 190;
  const colRateRightX = MARGIN + CONTENT_W - 100;
  const colAmountRightX = MARGIN + CONTENT_W;

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_W, height: 24, color: COLORS.indigoLight });
    page.drawText("DESCRIPTION", { x: MARGIN + 8, y: y - 15, size: 8, font: bold, color: COLORS.indigo });
    page.drawText("QTY", { x: colQtyX, y: y - 15, size: 8, font: bold, color: COLORS.indigo });
    drawRightAligned("RATE", colRateRightX, y - 15, 8, bold, COLORS.indigo);
    drawRightAligned("AMOUNT", colAmountRightX, y - 15, 8, bold, COLORS.indigo);
    y -= 30;
  };

  ensureSpace(60);
  drawTableHeader();

  const descMaxWidth = colQtyX - (MARGIN + 8) - 10;
  for (const item of invoice.lineItems) {
    const descLines = wrapText(item.description, regular, 9.5, descMaxWidth);
    const rowH = Math.max(20, descLines.length * 12 + 8);
    if (y - rowH < 74) {
      newPage();
      drawTableHeader();
    }
    descLines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 8, y: y - 13 - i * 12, size: 9.5, font: regular, color: COLORS.ink });
    });
    page.drawText(String(item.quantity), { x: colQtyX, y: y - 13, size: 9.5, font: regular, color: COLORS.slate });
    drawRightAligned(formatMoney(item.rate), colRateRightX, y - 13, 9.5, regular, COLORS.slate);
    drawRightAligned(formatMoney(item.amount), colAmountRightX, y - 13, 9.5, bold, COLORS.ink);
    y -= rowH;
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 0.5, color: COLORS.line });
  }

  y -= 16;
  ensureSpace(150);

  // ── Totals block ─────────────────────────────────────────────────────────
  const totalsW = 230;
  const totalsX = MARGIN + CONTENT_W - totalsW;
  const totalsRightEdge = MARGIN + CONTENT_W;

  const totalRow = (label: string, value: string, opts?: { bold?: boolean; muted?: boolean }) => {
    const font = opts?.bold ? bold : regular;
    const size = opts?.bold ? 10.5 : 9;
    const color = opts?.muted ? COLORS.slate : COLORS.ink;
    page.drawText(label, { x: totalsX, y, size, font, color });
    drawRightAligned(value, totalsRightEdge, y, size, font, opts?.bold ? COLORS.indigo : color);
    y -= 17;
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

  y -= 4;
  const bandH = 28;
  page.drawRectangle({ x: totalsX - 12, y: y - bandH + 12, width: totalsW + 12, height: bandH, color: COLORS.indigo });
  page.drawText("TOTAL DUE", { x: totalsX, y: y - 4, size: 10, font: bold, color: COLORS.white });
  drawRightAligned(formatMoney(invoice.total), totalsRightEdge, y - 5, 13, bold, COLORS.gold);
  y -= bandH + 10;

  if (invoice.paidAmount > 0) {
    totalRow("Paid", formatMoney(invoice.paidAmount), { muted: true });
    totalRow("Balance Due", formatMoney(invoice.total - invoice.paidAmount), { bold: true });
  }

  y -= 8;

  // ── Bank details — only when at least one field is actually filled in ───
  const bd = companySettings.bankDetails;
  const hasBankDetails = bd && (nonEmpty(bd.accountHolderName) || nonEmpty(bd.bankName) || nonEmpty(bd.accountNumber) || nonEmpty(bd.ifscCode));
  if (hasBankDetails && bd) {
    ensureSpace(90);
    page.drawText("PAYMENT DETAILS", { x: MARGIN, y, size: 8.5, font: bold, color: COLORS.gold });
    y -= 16;
    const bankLines = [
      nonEmpty(bd.accountHolderName) && `Account Holder: ${bd.accountHolderName}`,
      nonEmpty(bd.bankName) && `Bank: ${bd.bankName}`,
      nonEmpty(bd.accountNumber) && `Account No: ${bd.accountNumber}`,
      nonEmpty(bd.ifscCode) && `IFSC: ${bd.ifscCode}`,
    ].filter((line): line is string => Boolean(line));
    for (const line of bankLines) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: COLORS.slate });
      y -= 13;
    }
    y -= 6;
  }

  // ── Notes ─────────────────────────────────────────────────────────────
  if (nonEmpty(invoice.notes)) {
    ensureSpace(50);
    page.drawText("NOTES", { x: MARGIN, y, size: 8.5, font: bold, color: COLORS.gold });
    y -= 15;
    for (const line of wrapText(invoice.notes, regular, 9, CONTENT_W)) {
      ensureSpace(14);
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: COLORS.slate });
      y -= 13;
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    const footerY = 34;
    p.drawRectangle({ x: MARGIN, y: footerY + 10, width: CONTENT_W, height: 0.75, color: COLORS.line });
    p.drawText(issuer.footerNote, { x: MARGIN, y: footerY - 4, size: 7, font: regular, color: COLORS.faint });
    const pageNoText = `Page ${idx + 1} of ${pages.length}`;
    const pageNoW = regular.widthOfTextAtSize(pageNoText, 7);
    p.drawText(pageNoText, { x: PAGE_W - MARGIN - pageNoW, y: footerY - 4, size: 7, font: regular, color: COLORS.faint });
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
