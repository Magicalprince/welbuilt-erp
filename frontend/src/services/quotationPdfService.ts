import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Quotation, Client, Project, CompanySettings } from "@/types";
import { getCompanySettings } from "./settingsService";

// Same brand system as invoicePdfService.ts — kept in sync deliberately so a
// quotation and the invoice it later converts into look like one continuous
// document family, not two unrelated PDFs.

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

const COLORS = {
  ink: rgb(0.09, 0.09, 0.12),
  slate: rgb(0.42, 0.44, 0.5),
  faint: rgb(0.62, 0.64, 0.69),
  indigo: rgb(0.192, 0.204, 0.396),
  indigoLight: rgb(0.94, 0.945, 0.97),
  gold: rgb(0.784, 0.647, 0.078),
  white: rgb(1, 1, 1),
  line: rgb(0.88, 0.89, 0.91),
};

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

const STATUS_LABEL: Record<Quotation["status"], string> = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
};

export async function generateQuotationPdf(
  quotation: Quotation,
  client: Client,
  project: Project | null,
  companySettings: CompanySettings,
): Promise<Uint8Array> {
  const brand = BRANDS[quotation.brand ?? "sparks"];

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
    if (Y - needed < 90) newPage();
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

  const title = "QUOTATION";
  const titleSize = 22;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: W - MARGIN - titleW, y: H - 42, size: titleSize, font: bold, color: COLORS.white });

  const qNoText = `# ${quotation.quotationNumber}`;
  const qNoW = regular.widthOfTextAtSize(qNoText, 10);
  page.drawText(qNoText, { x: W - MARGIN - qNoW, y: H - 62, size: 10, font: regular, color: COLORS.gold });

  const statusText = STATUS_LABEL[quotation.status];
  const statusW = bold.widthOfTextAtSize(statusText, 9);
  page.drawRectangle({
    x: W - MARGIN - statusW - 16, y: H - 84, width: statusW + 16, height: 16,
    color: COLORS.white, opacity: 0.12,
  });
  page.drawText(statusText, { x: W - MARGIN - statusW - 8, y: H - 80, size: 9, font: bold, color: COLORS.white });

  Y = H - 118 - 30;

  // ── Prepared For / Quotation meta ─────────────────────────────────────────
  const colGap = 24;
  const colW = (CW - colGap) / 2;

  page.drawText("PREPARED FOR", { x: MARGIN, y: Y, size: 8, font: bold, color: COLORS.gold });
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
  metaRow("Issue Date", formatLong(quotation.issueDate));
  metaRow("Valid Until", formatLong(quotation.validUntil));
  if (project) metaRow("Project", project.title);
  if (quotation.gstType && quotation.gstType !== "NONE") {
    metaRow("Supply Type", quotation.gstType === "IGST" ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)");
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

  for (const item of quotation.lineItems) {
    const descLines = wrapText(item.description, regular, 9.5, CW - 210);
    const rowH = Math.max(18, descLines.length * 12 + 6);
    ensureSpace(rowH + 10);
    if (Y - rowH < 90) {
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

  totalRow("Subtotal", formatMoney(quotation.subtotal));

  if (quotation.gstType === "CGST_SGST") {
    totalRow(`CGST (${quotation.cgstPercent ?? 0}%)`, formatMoney(quotation.cgstAmount ?? 0), { muted: true });
    totalRow(`SGST (${quotation.sgstPercent ?? 0}%)`, formatMoney(quotation.sgstAmount ?? 0), { muted: true });
  } else if (quotation.gstType === "IGST") {
    totalRow(`IGST (${quotation.igstPercent ?? 0}%)`, formatMoney(quotation.igstAmount ?? 0), { muted: true });
  } else if (quotation.tax > 0) {
    totalRow("Tax", formatMoney(quotation.tax), { muted: true });
  }

  if (quotation.discount > 0) {
    totalRow("Discount", `- ${formatMoney(quotation.discount)}`, { muted: true });
  }

  page.drawRectangle({ x: totalsX, y: Y + 4, width: totalsW, height: 0.75, color: COLORS.line });
  Y -= 6;
  page.drawRectangle({ x: totalsX - 10, y: Y - 6, width: totalsW + 10, height: 26, color: COLORS.indigo });
  page.drawText("ESTIMATED TOTAL", { x: totalsX, y: Y + 3, size: 9.5, font: bold, color: COLORS.white });
  const totalText = formatMoney(quotation.total);
  const totalW = bold.widthOfTextAtSize(totalText, 13);
  page.drawText(totalText, { x: totalsX + totalsW - totalW, y: Y + 2, size: 13, font: bold, color: COLORS.gold });
  Y -= 34;

  // ── Terms & Notes ──────────────────────────────────────────────────────
  if (quotation.terms) {
    ensureSpace(50);
    page.drawText("TERMS & CONDITIONS", { x: MARGIN, y: Y, size: 8.5, font: bold, color: COLORS.gold });
    Y -= 15;
    for (const line of wrapText(quotation.terms, regular, 9, CW)) {
      ensureSpace(14);
      page.drawText(line, { x: MARGIN, y: Y, size: 9, font: regular, color: COLORS.slate });
      Y -= 13;
    }
    Y -= 6;
  }

  if (quotation.notes) {
    ensureSpace(50);
    page.drawText("NOTES", { x: MARGIN, y: Y, size: 8.5, font: bold, color: COLORS.gold });
    Y -= 15;
    for (const line of wrapText(quotation.notes, regular, 9, CW)) {
      ensureSpace(14);
      page.drawText(line, { x: MARGIN, y: Y, size: 9, font: regular, color: COLORS.slate });
      Y -= 13;
    }
    Y -= 6;
  }

  // Not-a-tax-invoice disclaimer — this is an estimate document, distinct
  // from the eventual GST tax invoice raised once the client accepts.
  ensureSpace(30);
  page.drawRectangle({ x: MARGIN, y: Y - 8, width: CW, height: 24, color: COLORS.indigoLight });
  const disclaimer = quotation.gstType && quotation.gstType !== "NONE"
    ? "This is a price quotation/estimate, not a tax invoice. GST shown is indicative and will be finalized on the tax invoice raised upon acceptance."
    : "This is a price quotation/estimate, not a tax invoice.";
  page.drawText(disclaimer, { x: MARGIN + 8, y: Y, size: 7.5, font: regular, color: COLORS.slate });
  Y -= 30;

  if (companySettings.bankDetails && quotation.status === "ACCEPTED") {
    ensureSpace(90);
    page.drawText("PAYMENT DETAILS (upon invoicing)", { x: MARGIN, y: Y, size: 8.5, font: bold, color: COLORS.gold });
    Y -= 16;
    const bd = companySettings.bankDetails;
    const bankLines = [
      `Account Holder: ${bd.accountHolderName}`,
      `Bank: ${bd.bankName}  |  Account No: ${bd.accountNumber}  |  IFSC: ${bd.ifscCode}`,
    ];
    for (const line of bankLines) {
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

export async function generateAndDownloadQuotationPdf(
  quotation: Quotation,
  client: Client,
  project: Project | null,
): Promise<void> {
  const companySettings = await getCompanySettings();
  const pdfBytes = await generateQuotationPdf(quotation, client, project, companySettings);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, `${quotation.quotationNumber}_${client.companyName.replace(/\s+/g, "_")}.pdf`);
}
