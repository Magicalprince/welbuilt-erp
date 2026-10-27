import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import { getCompanySettings } from "./settingsService";
import { amountInWords } from "@/lib/numberToWords";

// Bank-loan-submittable salary slip — classic bordered black-on-white
// layout family as invoicePdfService.ts, researched against what Indian
// banks (SBI, ICICI) actually check when a payslip is submitted as income
// proof, and cross-checked against real payslip templates (Zoho Payroll,
// Tally, Naukri, Angel One, Adobe's payslip guide). Three structural fixes
// over the first draft, all evidence-based:
//
// 1. Earnings|Deductions is a universal two-column convention even when
//    Deductions is empty — every real-world template surveyed shows a
//    "Deductions: NIL" row rather than omitting the column. Keeps the "no
//    fake ₹0 line items" principle (still no PF/ESI/TDS line items, this
//    company is well under the 20-employee PF threshold) while matching
//    the table SHAPE a bank loan officer expects to see.
// 2. A company seal renders at roughly 2-3in (144-216pt) on a real
//    business document, not 34pt (0.47in) — illegibly small at the
//    previous size. Signature and seal are now sized independently:
//    signature by its own aspect ratio capped at a readable width, seal
//    large and translucent behind it in the classic "signed over the
//    stamp" layering.
// 3. One continuous bordered frame from the header rule to the footer
//    bar (the Tally/Zoho convention this codebase's own
//    invoicePdfService.ts already uses) instead of separate floating
//    boxes with gaps between them, plus a drawn footer bar instead of
//    trailing-off floating text, so the page reads as filled-out rather
//    than sparse.

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
  footerBg: rgb(0.93, 0.93, 0.93),
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

function monthAbbrev(month: string): string {
  return month.slice(0, 3).toUpperCase();
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

  // ── Header: logo, address below it with real breathing room ───────────
  // Logo scaled smaller (26pt, down from 34pt) and given a 10pt gap
  // before the address starts (up from 4pt) — the previous combination
  // of a taller logo box and a thin gap let the wordmark's own internal
  // padding visually crowd the address text directly beneath it.
  const LOGO_H = 26;
  const logoTopY = y - 6;
  let headerY = logoTopY - LOGO_H - 10;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = LOGO_H / naturalDims.height;
    const logoW = naturalDims.width * scale;
    page.drawImage(logoImg, { x: MARGIN, y: logoTopY - LOGO_H, width: logoW, height: LOGO_H });
  }
  COMPANY_ADDRESS_LINES.forEach((line) => {
    page.drawText(line, { x: MARGIN, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 12;
  });
  if (gstin) {
    page.drawText(`GSTIN/UIN: ${gstin}`, { x: MARGIN, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 12;
  }

  const metaTop = headerY - 10;
  const slipNumber = `SAL-${data.employeeId}-${monthAbbrev(data.month)}${data.year}`;
  drawCentered("SALARY SLIP", PAGE_W / 2, metaTop, 14, bold);
  drawRightAligned(`Slip No: ${slipNumber}`, MARGIN + CONTENT_W, metaTop, 8.5, regular, COLORS.slate);
  drawRightAligned(`Pay Period: ${data.month} ${data.year}`, MARGIN + CONTENT_W, metaTop - 12, 8.5, regular, COLORS.slate);
  drawRightAligned(`Generated: ${formatShortDate(new Date())}`, MARGIN + CONTENT_W, metaTop - 24, 8.5, regular, COLORS.slate);

  y = metaTop - 38;

  // ── Unified outer frame — one continuous border from here down to the
  // footer bar, matching invoicePdfService.ts's own Tally/Zoho-style
  // convention, instead of separate floating boxes with gaps between
  // them. vLines for the left/right edges are drawn once at the end,
  // spanning the whole frame; hLines close off each internal section. ──
  const frameTop = y;
  hLine(frameTop);

  // ── Employee details grid — two columns of label/value pairs ──────────
  const employeeRows: [string, string][] = [
    ["Employee Name", data.founderName],
    ["Designation", data.designation],
    ["Employee ID", data.employeeId],
    ["Date of Joining", formatShortDate(data.dateOfJoining)],
    ["Pay Period", `${data.month} ${data.year}`],
  ];
  const rowH = 18;
  const colSplit = CONTENT_W * 0.35;
  let rowY = frameTop;
  employeeRows.forEach(([label, value], i) => {
    page.drawText(label, { x: MARGIN + 8, y: rowY - 13, size: 8.5, font: regular, color: COLORS.slate });
    page.drawText(value, { x: MARGIN + colSplit + 8, y: rowY - 13, size: 9.5, font: bold });
    if (i < employeeRows.length - 1) hLine(rowY - rowH, MARGIN, MARGIN + CONTENT_W);
    rowY -= rowH;
  });
  const employeeBottom = rowY;
  hLine(employeeBottom);
  vLine(MARGIN + colSplit, frameTop, employeeBottom);

  y = employeeBottom;

  // ── Earnings | Deductions two-column table — the universal convention
  // real payslip templates use even when Deductions is empty, with a
  // single "Deductions: NIL" summary row rather than fake ₹0 line items
  // (this company has no PF/ESI, well under the 20-employee threshold,
  // and salary is below the taxable slab). Matches the table SHAPE a
  // bank loan officer expects even though the Deductions side is empty. ──
  const colMidX = MARGIN + CONTENT_W / 2;
  const earnAmountRightX = colMidX - 8;
  const dedAmountRightX = MARGIN + CONTENT_W - 8;
  const tableTop = y;
  const colHeaderH = 20;
  page.drawRectangle({ x: MARGIN, y: tableTop - colHeaderH, width: CONTENT_W, height: colHeaderH, color: COLORS.headerBg });
  page.drawText("Earnings", { x: MARGIN + 8, y: tableTop - 14, size: 8.5, font: bold });
  drawRightAligned("Amount", earnAmountRightX, tableTop - 14, 8.5, bold);
  page.drawText("Deductions", { x: colMidX + 8, y: tableTop - 14, size: 8.5, font: bold });
  drawRightAligned("Amount", dedAmountRightX, tableTop - 14, 8.5, bold);
  hLine(tableTop, MARGIN, MARGIN + CONTENT_W);
  vLine(colMidX, tableTop, tableTop - colHeaderH);

  const dataRowTop = tableTop - colHeaderH;
  const dataRowH = 26;
  page.drawText("Basic Salary", { x: MARGIN + 8, y: dataRowTop - 16, size: 9.5, font: regular });
  drawRightAligned(formatMoney(data.amount), earnAmountRightX, dataRowTop - 16, 9.5, regular);
  page.drawText("NIL", { x: colMidX + 8, y: dataRowTop - 16, size: 9.5, font: regular, color: COLORS.slate });
  drawRightAligned("0.00", dedAmountRightX, dataRowTop - 16, 9.5, regular, COLORS.slate);
  const dataRowBottom = dataRowTop - dataRowH;
  hLine(dataRowBottom, MARGIN, MARGIN + CONTENT_W);
  vLine(colMidX, dataRowTop, dataRowBottom);

  const totalRowTop = dataRowBottom;
  const totalRowH = 24;
  page.drawText("Total Earnings", { x: MARGIN + 8, y: totalRowTop - 15, size: 9.5, font: bold });
  drawRightAligned(formatMoney(data.amount), earnAmountRightX, totalRowTop - 15, 10, bold);
  page.drawText("Total Deductions", { x: colMidX + 8, y: totalRowTop - 15, size: 9.5, font: bold });
  drawRightAligned("0.00", dedAmountRightX, totalRowTop - 15, 10, bold);
  const totalRowBottom = totalRowTop - totalRowH;
  hLine(totalRowBottom, MARGIN, MARGIN + CONTENT_W);
  vLine(colMidX, totalRowTop, totalRowBottom);

  y = totalRowBottom;

  // ── Net Pay — figures + words ──────────────────────────────────────────
  const netBoxH = 46;
  const netTop = y;
  const netBottom = netTop - netBoxH;
  page.drawText("Net Pay", { x: MARGIN + 8, y: netTop - 17, size: 10, font: bold });
  drawRightAligned(formatMoney(data.amount), MARGIN + CONTENT_W - 8, netTop - 19, 16, bold);
  page.drawText(amountInWords(data.amount), { x: MARGIN + 8, y: netTop - 34, size: 8.5, font: regular, color: COLORS.slate });
  hLine(netBottom, MARGIN, MARGIN + CONTENT_W);

  y = netBottom;

  // ── Bank details — the account this salary is credited to; a loan
  // officer cross-checks this against the applicant's bank statement. ───
  const hasBankDetails = bd && (bd.accountHolderName || bd.bankName || bd.accountNumber || bd.ifscCode);
  const bankTop = y;
  let bankBottom = bankTop;
  if (hasBankDetails && bd) {
    page.drawText("Salary Credited To", { x: MARGIN + 8, y: bankTop - 15, size: 8.5, font: bold });
    page.drawText("Payment Mode: Bank Transfer (NEFT)", { x: colMidX + 8, y: bankTop - 15, size: 8, font: regular, color: COLORS.slate });
    let by = bankTop - 29;
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
    bankBottom = bankTop - Math.max(60, 24 + bankLines.length * 11 + 8);
    hLine(bankBottom, MARGIN, MARGIN + CONTENT_W);
  }

  y = bankBottom - 20;

  // ── Signature block — seal large and legible behind, signature sized
  // by its own aspect ratio on top, "signed over the stamp" layering. ───
  const sigBlockRightX = MARGIN + CONTENT_W - 16;
  const sigLabel = `for ${COMPANY_NAME}`;
  drawRightAligned(sigLabel, sigBlockRightX, y, 9, bold);

  // Seal: real company seals render 2-3in (144-216pt) on a business
  // document — the previous 34pt (0.47in) was illegibly small. Sized to
  // 120pt here, capped against the content width so it can never run off
  // the page edge even for a seal asset with an unusual aspect ratio.
  const SEAL_H = 120;
  const sealTopY = y - 10;
  let sealW = 0;
  if (sealImg) {
    const naturalDims = sealImg.scale(1);
    const scale = SEAL_H / naturalDims.height;
    sealW = Math.min(naturalDims.width * scale, CONTENT_W * 0.35);
    page.drawImage(sealImg, {
      x: sigBlockRightX - sealW,
      y: sealTopY - SEAL_H,
      width: sealW,
      height: SEAL_H,
      opacity: 0.55,
    });
  }

  // Signature: sized by its own aspect ratio (not forced to the seal's
  // height) — a signature is conventionally ~1-1.5in wide, not as tall as
  // a seal — capped at 40pt tall so a very wide/short signature asset
  // doesn't stretch distractingly thin. Drawn fully opaque, overlapping
  // the lower-third of the seal (the conventional "signed over the
  // stamp" look) instead of placed 40pt apart in empty space.
  const SIG_MAX_H = 40;
  const SIG_MAX_W = 110;
  let sigImgBottomY = sealTopY - SEAL_H * 0.55;
  if (signatureImg) {
    const naturalDims = signatureImg.scale(1);
    const heightFromWidth = SIG_MAX_W * (naturalDims.height / naturalDims.width);
    const sigH = Math.min(SIG_MAX_H, heightFromWidth);
    const sigW = sigH * (naturalDims.width / naturalDims.height);
    const sigX = sigBlockRightX - sealW / 2 - sigW / 2;
    const sigY = sealTopY - SEAL_H * 0.42 - sigH / 2;
    page.drawImage(signatureImg, { x: sigX, y: sigY, width: sigW, height: sigH });
    sigImgBottomY = sigY;
  } else {
    // Missing signature asset is visibly diagnosable, not a silent blank —
    // a dashed underline plus a labelled placeholder instead of empty space.
    const lineY = sealTopY - SEAL_H * 0.5;
    page.drawLine({
      start: { x: sigBlockRightX - 90, y: lineY },
      end: { x: sigBlockRightX, y: lineY },
      thickness: 0.75,
      color: COLORS.slate,
      dashArray: [2, 2],
    });
    drawCentered("Signature on file", sigBlockRightX - 45, lineY - 10, 7, regular, COLORS.slate);
    sigImgBottomY = lineY - 10;
  }

  const sigBlockBottom = Math.min(sealTopY - SEAL_H, sigImgBottomY) - 14;
  drawRightAligned("Authorised Signatory", sigBlockRightX, sigBlockBottom, 8, regular, COLORS.slate);

  y = sigBlockBottom - 16;
  hLine(y, MARGIN, MARGIN + CONTENT_W);

  // ── Footer bar — a drawn band, not floating text, so the page has a
  // clear bottom edge instead of trailing off into blank space. ─────────
  const footerH = 24;
  const footerTop = y;
  const footerBottom = Math.min(footerTop - footerH, MARGIN + 20);
  page.drawRectangle({ x: MARGIN, y: footerBottom, width: CONTENT_W, height: footerTop - footerBottom, color: COLORS.footerBg });
  drawCentered(
    `This is a salary statement issued by ${COMPANY_NAME} for the period indicated above.`,
    PAGE_W / 2,
    (footerTop + footerBottom) / 2 - 3,
    7.5,
    regular,
    COLORS.slate
  );
  hLine(footerBottom, MARGIN, MARGIN + CONTENT_W);

  // Outer left/right border spanning the whole unified frame, header rule
  // to footer rule.
  vLine(MARGIN, frameTop, footerBottom);
  vLine(MARGIN + CONTENT_W, frameTop, footerBottom);

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
