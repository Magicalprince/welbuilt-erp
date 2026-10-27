import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import { getCompanySettings } from "./settingsService";
import { amountInWords } from "@/lib/numberToWords";

// Bank-loan-submittable salary slip — same classic bordered black-on-white
// layout family as invoicePdfService.ts (page size, margins, font
// embedding, draw-helper conventions), researched against what Indian
// banks (SBI, ICICI) actually check when a payslip is submitted as income
// proof: company header, employee details matching KYC, pay period,
// itemized earnings, net pay in figures AND words, bank credit details,
// and a real signature+seal block — NOT the "computer-generated, no
// signature required" convention regular invoices use, since a
// self-issued payslip from one's own company needs more credibility, not
// less. No deductions table: this company has no PF/ESI (well under the
// 20-employee mandatory-registration threshold) and salary is below the
// taxable slab, so gross = net and the row is omitted entirely rather
// than shown as "N/A" or ₹0 (the more credible convention for a small
// company's payslip, per research).

const COMPANY_NAME = "Welbuilt AI Solutions Pvt Ltd";
const COMPANY_ADDRESS_LINES = [
  "23/14 A, Ramalinganar 6th Street",
  "Tiruvannamalai, Tamil Nadu - 606601",
];
const LOGO_PATH = "/images/logo-full.png";
const SEAL_PATH = "/images/seal.png";
const BARANITHARAN_SIGNATURE_PATH = "/images/sparks/signature.png";

const COLORS = {
  ink: rgb(0.05, 0.05, 0.05),
  slate: rgb(0.3, 0.3, 0.3),
  line: rgb(0, 0, 0),
  headerBg: rgb(0.93, 0.93, 0.93),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatShortDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const year = (date.getFullYear() % 100).toString().padStart(2, "0");
  return `${day}-${month}-${year}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export type SignatureKey = "baranitharan" | "ramachandraa";

export interface SalarySlipData {
  founderName: string;
  designation: string;
  employeeId: string;
  dateOfJoining: Date;
  month: string; // full month name, e.g. "August"
  year: number;
  amount: number;
  signatureKey: SignatureKey;
}

export async function generateSalarySlipPdf(data: SalarySlipData): Promise<Uint8Array> {
  const companySettings = await getCompanySettings();
  const gstin = companySettings.gstNumber;
  const bd = companySettings.bankDetails;

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

  const signaturePath =
    data.signatureKey === "ramachandraa" ? companySettings.ramachandraaSignatureUrl : BARANITHARAN_SIGNATURE_PATH;

  const [logoBytes, sealBytes, signatureBytes] = await Promise.all([
    fetchBytes(LOGO_PATH),
    fetchBytes(SEAL_PATH),
    signaturePath ? fetchBytes(signaturePath) : Promise.resolve(null),
  ]);
  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null;
  const sealImg = sealBytes ? await pdfDoc.embedPng(sealBytes).catch(() => null) : null;
  const signatureImg = signatureBytes ? await pdfDoc.embedPng(signatureBytes).catch(() => null) : null;

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const drawRightAligned = (text: string, rightX: number, yPos: number, size: number, font: import("pdf-lib").PDFFont, color: ReturnType<typeof rgb> = COLORS.ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - w, y: yPos, size, font, color });
    return w;
  };

  const drawCentered = (text: string, centerX: number, yPos: number, size: number, font: import("pdf-lib").PDFFont, color: ReturnType<typeof rgb> = COLORS.ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: centerX - w / 2, y: yPos, size, font, color });
  };

  const hLine = (yPos: number, x1: number = MARGIN, x2: number = MARGIN + CONTENT_W) => {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.75, color: COLORS.line });
  };

  const vLine = (xPos: number, y1: number, y2: number) => {
    page.drawLine({ start: { x: xPos, y: y1 }, end: { x: xPos, y: y2 }, thickness: 0.75, color: COLORS.line });
  };

  // ── Header: logo, address below it, title + pay period ────────────────
  const LOGO_H = 34;
  const logoTopY = y - 6;
  let headerY = logoTopY - LOGO_H - 4;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = LOGO_H / naturalDims.height;
    const logoW = naturalDims.width * scale;
    page.drawImage(logoImg, { x: MARGIN, y: logoTopY - LOGO_H, width: logoW, height: LOGO_H });
  }
  COMPANY_ADDRESS_LINES.forEach((line) => {
    page.drawText(line, { x: MARGIN, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  });
  if (gstin) {
    page.drawText(`GSTIN/UIN: ${gstin}`, { x: MARGIN, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  }

  const metaTop = headerY - 10;
  drawCentered("SALARY SLIP", PAGE_W / 2, metaTop, 14, bold);
  drawRightAligned(`Pay Period: ${data.month} ${data.year}`, MARGIN + CONTENT_W, metaTop, 8.5, regular, COLORS.slate);
  drawRightAligned(`Generated: ${formatShortDate(new Date())}`, MARGIN + CONTENT_W, metaTop - 12, 8.5, regular, COLORS.slate);

  y = metaTop - 24;
  hLine(y);
  y -= 4;
  const outerTop = y;

  // ── Employee details grid — two columns of label/value pairs ──────────
  const employeeRows: [string, string][] = [
    ["Employee Name", data.founderName],
    ["Designation", data.designation],
    ["Employee ID", data.employeeId],
    ["Date of Joining", formatShortDate(data.dateOfJoining)],
    ["Pay Period", `${data.month} ${data.year}`],
  ];
  const rowH = 17;
  const colSplit = CONTENT_W * 0.35;
  let rowY = outerTop;
  employeeRows.forEach(([label, value], i) => {
    page.drawText(label, { x: MARGIN + 8, y: rowY - 12, size: 8.5, font: regular, color: COLORS.slate });
    page.drawText(value, { x: MARGIN + colSplit + 8, y: rowY - 12, size: 9.5, font: bold });
    if (i < employeeRows.length - 1) hLine(rowY - rowH, MARGIN, MARGIN + CONTENT_W);
    rowY -= rowH;
  });
  const employeeBottom = rowY;
  hLine(outerTop);
  hLine(employeeBottom);
  vLine(MARGIN, outerTop, employeeBottom);
  vLine(MARGIN + CONTENT_W, outerTop, employeeBottom);
  vLine(MARGIN + colSplit, outerTop, employeeBottom);

  y = employeeBottom - 16;

  // ── Earnings table — single "Basic Salary" row, no deductions table.
  // Gross = net: omitted entirely rather than shown as "N/A"/₹0, the more
  // credible convention for a small company with no PF/ESI registration. ──
  const colDescDivX = MARGIN + CONTENT_W - 150;
  const colAmountRightX = MARGIN + CONTENT_W - 8;
  const tableTop = y;
  const headerH = 20;
  page.drawRectangle({ x: MARGIN, y: tableTop - headerH, width: CONTENT_W, height: headerH, color: COLORS.headerBg });
  hLine(tableTop, MARGIN, MARGIN + CONTENT_W);
  page.drawText("Earnings", { x: MARGIN + 8, y: tableTop - 14, size: 8.5, font: bold });
  drawRightAligned("Amount", colAmountRightX, tableTop - 14, 8.5, bold);
  vLine(MARGIN, tableTop, tableTop - headerH);
  vLine(MARGIN + CONTENT_W, tableTop, tableTop - headerH);
  vLine(colDescDivX, tableTop, tableTop - headerH);

  const earningsRowTop = tableTop - headerH;
  page.drawText("Basic Salary", { x: MARGIN + 8, y: earningsRowTop - 15, size: 9.5, font: regular });
  drawRightAligned(formatMoney(data.amount), colAmountRightX, earningsRowTop - 15, 9.5, regular);
  const earningsRowBottom = earningsRowTop - 24;
  hLine(earningsRowBottom);
  vLine(MARGIN, earningsRowTop, earningsRowBottom);
  vLine(MARGIN + CONTENT_W, earningsRowTop, earningsRowBottom);
  vLine(colDescDivX, earningsRowTop, earningsRowBottom);

  const totalRowBottom = earningsRowBottom - 24;
  page.drawText("Total Earnings", { x: MARGIN + 8, y: earningsRowBottom - 15, size: 10, font: bold });
  drawRightAligned(formatMoney(data.amount), colAmountRightX, earningsRowBottom - 15, 11, bold);
  hLine(totalRowBottom);
  vLine(MARGIN, earningsRowBottom, totalRowBottom);
  vLine(MARGIN + CONTENT_W, earningsRowBottom, totalRowBottom);

  y = totalRowBottom - 16;

  // ── Net Pay box — figures + words ──────────────────────────────────────
  const netBoxH = 44;
  const netTop = y;
  const netBottom = netTop - netBoxH;
  vLine(MARGIN, netTop, netBottom);
  vLine(MARGIN + CONTENT_W, netTop, netBottom);
  hLine(netTop);
  hLine(netBottom);
  page.drawText("Net Pay", { x: MARGIN + 8, y: netTop - 16, size: 10, font: bold });
  drawRightAligned(formatMoney(data.amount), colAmountRightX, netTop - 18, 15, bold);
  page.drawText(amountInWords(data.amount), { x: MARGIN + 8, y: netTop - 32, size: 8.5, font: regular, color: COLORS.slate });

  y = netBottom - 16;

  // ── Bank details block — the account this salary is credited to; a
  // loan officer cross-checks this against the applicant's bank statement. ──
  const hasBankDetails = bd && (bd.accountHolderName || bd.bankName || bd.accountNumber || bd.ifscCode);
  const bankTop = y;
  const bankBlockH = hasBankDetails ? 24 + 44 : 0;
  if (hasBankDetails && bd) {
    page.drawText("Salary Credited To", { x: MARGIN + 8, y: bankTop - 14, size: 8.5, font: bold });
    let by = bankTop - 28;
    const bankLines = [
      bd.accountHolderName && `A/c Holder's Name: ${bd.accountHolderName}`,
      bd.bankName && `Bank Name: ${bd.bankName}`,
      bd.accountNumber && `A/c No.: ${bd.accountNumber}`,
      bd.ifscCode && `IFSC Code: ${bd.ifscCode}`,
    ].filter((line): line is string => Boolean(line));
    for (const line of bankLines) {
      page.drawText(line, { x: MARGIN + 8, y: by, size: 8, font: regular, color: COLORS.slate });
      by -= 11;
    }
    vLine(MARGIN, bankTop, bankTop - bankBlockH);
    vLine(MARGIN + CONTENT_W, bankTop, bankTop - bankBlockH);
    hLine(bankTop);
    hLine(bankTop - bankBlockH);
    y = bankTop - bankBlockH - 16;
  }

  // ── Signature block — a real signature + seal, not "no signature
  // required": a self-issued payslip from one's own company needs more
  // credibility, not less, for bank loan submission. Same layered
  // seal-behind/signature-on-top convention and sizing as
  // invoicePdfService.ts, reused exactly for visual consistency. ──────────
  const SIGNATURE_IMG_H = 34;
  const sigBlockRightX = MARGIN + CONTENT_W - 8;
  const sigLabel = `for ${COMPANY_NAME}`;
  drawRightAligned(sigLabel, sigBlockRightX, y, 8.5, bold);
  const sigImgTopY = y - 4;

  if (sealImg) {
    const naturalDims = sealImg.scale(1);
    const scale = SIGNATURE_IMG_H / naturalDims.height;
    const w = naturalDims.width * scale;
    page.drawImage(sealImg, {
      x: sigBlockRightX - w - 40,
      y: sigImgTopY - SIGNATURE_IMG_H,
      width: w,
      height: SIGNATURE_IMG_H,
      opacity: 0.85,
    });
  }
  if (signatureImg) {
    const naturalDims = signatureImg.scale(1);
    const scale = SIGNATURE_IMG_H / naturalDims.height;
    const w = naturalDims.width * scale;
    page.drawImage(signatureImg, {
      x: sigBlockRightX - w,
      y: sigImgTopY - SIGNATURE_IMG_H,
      width: w,
      height: SIGNATURE_IMG_H,
    });
  }

  const sigBlockBottom = sigImgTopY - SIGNATURE_IMG_H - 16;
  drawRightAligned("Authorised Signatory", sigBlockRightX, sigBlockBottom, 8, regular, COLORS.slate);

  // ── Footer ──────────────────────────────────────────────────────────────
  drawCentered(
    `This is a salary statement issued by ${COMPANY_NAME} for the period indicated above.`,
    PAGE_W / 2,
    MARGIN + 10,
    7.5,
    regular,
    COLORS.slate
  );

  return pdfDoc.save();
}

export async function generateSalarySlipPdfBlob(data: SalarySlipData): Promise<Blob> {
  const pdfBytes = await generateSalarySlipPdf(data);
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export async function generateSalarySlipPdfUrl(data: SalarySlipData): Promise<string> {
  const blob = await generateSalarySlipPdfBlob(data);
  return URL.createObjectURL(blob);
}

export async function generateAndDownloadSalarySlip(data: SalarySlipData): Promise<void> {
  const blob = await generateSalarySlipPdfBlob(data);
  saveAs(blob, `Salary_Slip_${data.founderName.replace(/\s+/g, "_")}_${data.month}_${data.year}.pdf`);
}
