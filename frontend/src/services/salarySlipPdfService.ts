import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import { getCompanySettings } from "./settingsService";
import { amountInWords } from "@/lib/numberToWords";

// Bank-loan-submittable salary slip — classic bordered black-on-white
// layout family as invoicePdfService.ts, researched twice against real
// payslip templates (Zoho Payroll, Tally, Naukri, Angel One), bank loan
// documentation requirements (SBI, ICICI), and the Code on Wages 2019 /
// Form V statutory wage-slip field list. Field decisions, each sourced:
//
// - LEGALLY REQUIRED (Code on Wages 2019 + Central Rules "Form V", per
//   https://hrengage.ai/blog/payslip-format-india): employer name/address,
//   employee name/designation/code, wage period, days paid, EACH earnings
//   component shown separately (not consolidated — hence the itemized
//   Basic/HRA/Special Allowance breakdown below, not a single line),
//   EACH deduction shown separately + total, net wages + mode of payment,
//   PF/ESI "where applicable". PAN is NOT in this statutory list.
// - BANK-LOAN CRITICAL: employee PAN (SBI requires it —
//   https://sbi.co.in/web/faq-s/faq-personal-loan — ICICI doesn't
//   penalize its presence either); the salary bank account must match
//   what the applicant's bank statements show
//   (https://www.icici.bank.in/personal-banking/loans/personal-loan/documentation,
//   https://bankbazaar.com/personal-loan/documents-required-for-personal-loan.html).
// - STANDARD/EXPECTED (Zoho's "7 essential elements" —
//   https://www.zoho.com/in/payroll/academy/payroll-administration/salary-slip.html):
//   company TAN (not PAN — TDS reporting uses TAN), Gross/Deductions/Net
//   + YTD totals, itemized earnings breakdown, UAN shown as a labelled
//   field even when "N/A" rather than omitted.
//
// This company has no PF/ESI/TDS (well under the 20-employee PF
// threshold, salary below the taxable slab) — those rows are shown as
// "N/A"/"NIL" rather than omitted, matching Form V's "where applicable"
// convention and reading as an honest small-company document rather than
// an incomplete one.

const COMPANY_NAME = "Welbuilt AI Solutions Pvt Ltd";
const COMPANY_ADDRESS_LINES = [
  "23/14 A, Ramalinganar 6th Street",
  "Tiruvannamalai, Tamil Nadu - 606601",
];
const LOGO_PATH = "/images/logo-full.png";
const SEAL_PATH = "/images/seal.png";
const BARANITHARAN_SIGNATURE_PATH = "/images/sparks/signature.png";

// Clearly-fake placeholder shapes (real PAN/account formats, obviously
// not real values) so a generated slip never shows a blank where a
// bank-critical field belongs, but also never shows a plausible-looking
// fabricated number that could be mistaken for real. Settings → Salary
// page lets the user override these with real values per founder.
const PLACEHOLDER_PAN = "PAN NOT SET";
const PLACEHOLDER_BANK_ACCOUNT = "ACCOUNT NOT SET";
const PLACEHOLDER_IFSC = "IFSC NOT SET";
const PLACEHOLDER_BANK_NAME = "BANK NOT SET";

const COLORS = {
  ink: rgb(0.05, 0.05, 0.05),
  slate: rgb(0.3, 0.3, 0.3),
  line: rgb(0, 0, 0),
  headerBg: rgb(0.93, 0.93, 0.93),
  footerBg: rgb(0.93, 0.93, 0.93),
  placeholder: rgb(0.65, 0.15, 0.15),
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

function daysInMonth(month: string, year: number): number {
  const idx = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(month.toLowerCase());
  if (idx === -1) return 30;
  return new Date(year, idx + 1, 0).getDate();
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// The seal and signature source PNGs carry a lot of blank white/transparent
// margin around the actual artwork (the seal especially — a tall portrait
// image with the circular stamp occupying only its middle band). Scaling
// those images up by height makes the margin grow right along with the
// artwork, so the visible stamp/signature never gets proportionally
// bigger. This crops each image down to the tight bounding box of its
// non-blank pixels before it's embedded, so every point of the height
// budget given to it in the PDF is actual ink. Browser-only (Canvas), but
// this whole service already only runs client-side.
async function cropToContent(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const blob = new Blob([bytes], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return bytes;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const alpha = data[i + 3];
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isBlank = alpha < 10 || (r > 248 && g > 248 && b > 248);
      if (!isBlank) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (maxX < minX || maxY < minY) return bytes; // nothing found — fall back to original

  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) return bytes;
  cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  const croppedBlob: Blob | null = await new Promise((resolve) => cropCanvas.toBlob(resolve, "image/png"));
  if (!croppedBlob) return bytes;
  return croppedBlob.arrayBuffer();
}

export type SignatureKey = "baranitharan" | "ramachandraa";

export const PAYMENT_MODES = ["Bank Transfer (NEFT)", "Bank Transfer (IMPS)", "Bank Transfer (RTGS)", "Cheque", "Cash"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export interface SalarySlipData {
  founderName: string;
  designation: string;
  employeeId: string;
  dateOfJoining: Date;
  month: string; // full month name, e.g. "August"
  year: number;
  amount: number;
  signatureKey: SignatureKey;
  // Used to look up per-founder PAN/bank details from companySettings —
  // falls back to placeholder values when not yet configured.
  founderEmail?: string;
  // Year-to-date figures (sum of all salary taken so far this fiscal
  // year, including this slip's amount) — standard per Zoho's "7
  // essential elements". Optional: callers that don't have this
  // computed (e.g. the mock-slip generator, which has no real salary
  // history to sum) can omit it and the YTD row is skipped entirely
  // rather than shown as a misleading 0.
  ytdGross?: number;
  // Defaults to NEFT — editable per-slip since not every payment was
  // necessarily made the same way.
  paymentMode?: PaymentMode;
}

export async function generateSalarySlipPdf(data: SalarySlipData): Promise<Uint8Array> {
  const companySettings = await getCompanySettings();
  const companyPan = companySettings.panNumber || PLACEHOLDER_PAN;
  const companyTan = companySettings.tanNumber;
  const founderPayroll = data.founderEmail
    ? companySettings.founderPayrollInfo?.[data.founderEmail.toLowerCase()]
    : undefined;
  const employeePan = founderPayroll?.pan || PLACEHOLDER_PAN;
  const bankAccountNumber = founderPayroll?.bankAccountNumber || PLACEHOLDER_BANK_ACCOUNT;
  const bankName = founderPayroll?.bankName || PLACEHOLDER_BANK_NAME;
  const ifscCode = founderPayroll?.ifscCode || PLACEHOLDER_IFSC;

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

  const [logoBytes, sealBytesRaw, signatureBytesRaw] = await Promise.all([
    fetchBytes(LOGO_PATH),
    fetchBytes(SEAL_PATH),
    signaturePath ? fetchBytes(signaturePath) : Promise.resolve(null),
  ]);
  const [sealBytes, signatureBytes] = await Promise.all([
    sealBytesRaw ? cropToContent(sealBytesRaw).catch(() => sealBytesRaw) : Promise.resolve(null),
    signatureBytesRaw ? cropToContent(signatureBytesRaw).catch(() => signatureBytesRaw) : Promise.resolve(null),
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
  const companyIdParts = [companyTan && `TAN: ${companyTan}`, `PAN: ${companyPan}`].filter(Boolean);
  page.drawText(companyIdParts.join("   |   "), { x: MARGIN, y: headerY, size: 8, font: regular, color: COLORS.slate });
  headerY -= 12;

  const metaTop = headerY - 10;
  const slipNumber = `SAL-${data.employeeId}-${monthAbbrev(data.month)}${data.year}`;
  drawCentered("SALARY SLIP", PAGE_W / 2, metaTop, 14, bold);
  drawRightAligned(`Slip No: ${slipNumber}`, MARGIN + CONTENT_W, metaTop, 8.5, regular, COLORS.slate);
  drawRightAligned(`Pay Period: ${data.month} ${data.year}`, MARGIN + CONTENT_W, metaTop - 12, 8.5, regular, COLORS.slate);
  drawRightAligned(`Generated: ${formatShortDate(new Date())}`, MARGIN + CONTENT_W, metaTop - 24, 8.5, regular, COLORS.slate);

  y = metaTop - 38;

  // ── Unified outer frame — one continuous border from here down to the
  // footer bar, instead of separate floating boxes with gaps between them.
  const frameTop = y;
  hLine(frameTop);

  // ── Employee details grid — three columns worth of label/value pairs,
  // wrapped two-per-row, covering every LEGALLY REQUIRED identity field
  // (name, designation, employee code) plus PAN/UAN/bank fields research
  // confirmed as standard/bank-critical. ──────────────────────────────────
  const totalDays = daysInMonth(data.month, data.year);
  const colSplit = CONTENT_W * 0.32;
  const col2X = MARGIN + CONTENT_W * 0.52;
  const col2Split = col2X + CONTENT_W * 0.2;

  type GridRow = { leftLabel: string; leftValue: string; leftPlaceholder?: boolean; rightLabel?: string; rightValue?: string; rightPlaceholder?: boolean };
  const employeeRows: GridRow[] = [
    { leftLabel: "Employee Name", leftValue: data.founderName, rightLabel: "Designation", rightValue: data.designation },
    { leftLabel: "Employee ID", leftValue: data.employeeId, rightLabel: "Date of Joining", rightValue: formatShortDate(data.dateOfJoining) },
    { leftLabel: "PAN", leftValue: employeePan, leftPlaceholder: employeePan === PLACEHOLDER_PAN, rightLabel: "UAN (PF)", rightValue: "NIL" },
    { leftLabel: "Pay Period", leftValue: `${data.month} ${data.year}`, rightLabel: "Days Paid", rightValue: `${totalDays} / ${totalDays}` },
    { leftLabel: "Bank Account", leftValue: bankAccountNumber, leftPlaceholder: bankAccountNumber === PLACEHOLDER_BANK_ACCOUNT, rightLabel: "IFSC", rightValue: ifscCode, rightPlaceholder: ifscCode === PLACEHOLDER_IFSC },
  ];
  const rowH = 18;
  let rowY = frameTop;
  employeeRows.forEach((row, i) => {
    page.drawText(row.leftLabel, { x: MARGIN + 8, y: rowY - 13, size: 8.5, font: regular, color: COLORS.slate });
    page.drawText(row.leftValue, { x: MARGIN + colSplit + 8, y: rowY - 13, size: 9, font: bold, color: row.leftPlaceholder ? COLORS.placeholder : COLORS.ink });
    if (row.rightLabel) {
      page.drawText(row.rightLabel, { x: col2X + 4, y: rowY - 13, size: 8.5, font: regular, color: COLORS.slate });
      page.drawText(row.rightValue || "", { x: col2Split + 4, y: rowY - 13, size: 9, font: bold, color: row.rightPlaceholder ? COLORS.placeholder : COLORS.ink });
    }
    if (i < employeeRows.length - 1) hLine(rowY - rowH, MARGIN, MARGIN + CONTENT_W);
    rowY -= rowH;
  });
  const employeeBottom = rowY;
  hLine(employeeBottom);
  vLine(MARGIN + colSplit, frameTop, employeeBottom);
  vLine(col2X, frameTop, employeeBottom);
  vLine(col2Split, frameTop, employeeBottom);

  // Bank name line below the grid (doesn't fit the 4-column layout above) —
  // still inside the frame, small italic-weight note.
  const paymentMode = data.paymentMode || "Bank Transfer (NEFT)";
  page.drawText(`Bank: ${bankName}  •  Mode of Payment: ${paymentMode}`, {
    x: MARGIN + 8,
    y: employeeBottom - 13,
    size: 7.5,
    font: regular,
    color: bankName === PLACEHOLDER_BANK_NAME ? COLORS.placeholder : COLORS.slate,
  });
  const bankNoteBottom = employeeBottom - 20;
  hLine(bankNoteBottom, MARGIN, MARGIN + CONTENT_W);

  y = bankNoteBottom;

  // ── Earnings | Deductions two-column table — itemized Basic/HRA/Special
  // Allowance breakdown (the standard convention every real template
  // surveyed uses, even for a flat/simple salary — a single "Basic
  // Salary" line was part of the original "looks incomplete" complaint),
  // 50/40/10 split summing to the same gross. Deductions shown as NIL
  // rather than omitted (no PF/ESI/TDS — company is well under the
  // 20-employee PF threshold, salary below the taxable slab), matching
  // Form V's "where applicable" convention. ──────────────────────────────
  const basic = Math.round(data.amount * 0.5);
  const hra = Math.round(data.amount * 0.4);
  const specialAllowance = data.amount - basic - hra;

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

  const earningsLines: [string, number][] = [
    ["Basic Salary", basic],
    ["House Rent Allowance (HRA)", hra],
    ["Special Allowance", specialAllowance],
  ];
  const deductionLines: string[] = ["Provident Fund (PF)", "Professional Tax", "TDS / Income Tax"];

  const lineRowH = 15;
  const maxLines = Math.max(earningsLines.length, deductionLines.length);
  let dataRowY = tableTop - colHeaderH;
  for (let i = 0; i < maxLines; i++) {
    const earn = earningsLines[i];
    if (earn) {
      page.drawText(earn[0], { x: MARGIN + 8, y: dataRowY - 11, size: 8.5, font: regular });
      drawRightAligned(formatMoney(earn[1]), earnAmountRightX, dataRowY - 11, 8.5, regular);
    }
    const ded = deductionLines[i];
    if (ded) {
      page.drawText(ded, { x: colMidX + 8, y: dataRowY - 11, size: 8.5, font: regular, color: COLORS.slate });
      drawRightAligned("NIL", dedAmountRightX, dataRowY - 11, 8.5, regular, COLORS.slate);
    }
    dataRowY -= lineRowH;
  }
  const dataRowBottom = dataRowY;
  hLine(dataRowBottom, MARGIN, MARGIN + CONTENT_W);
  vLine(colMidX, tableTop - colHeaderH, dataRowBottom);

  const totalRowTop = dataRowBottom;
  const totalRowH = 22;
  page.drawText("Gross Earnings", { x: MARGIN + 8, y: totalRowTop - 15, size: 9.5, font: bold });
  drawRightAligned(formatMoney(data.amount), earnAmountRightX, totalRowTop - 15, 10, bold);
  page.drawText("Total Deductions", { x: colMidX + 8, y: totalRowTop - 15, size: 9.5, font: bold });
  drawRightAligned("0.00", dedAmountRightX, totalRowTop - 15, 10, bold);
  const totalRowBottom = totalRowTop - totalRowH;
  hLine(totalRowBottom, MARGIN, MARGIN + CONTENT_W);
  vLine(colMidX, totalRowTop, totalRowBottom);

  y = totalRowBottom;

  // ── Net Pay — figures + words, plus YTD if supplied ────────────────────
  const hasYtd = data.ytdGross !== undefined;
  const netBoxH = hasYtd ? 60 : 46;
  const netTop = y;
  const netBottom = netTop - netBoxH;
  page.drawText("Net Pay", { x: MARGIN + 8, y: netTop - 17, size: 10, font: bold });
  drawRightAligned(formatMoney(data.amount), MARGIN + CONTENT_W - 8, netTop - 19, 16, bold);
  page.drawText(amountInWords(data.amount), { x: MARGIN + 8, y: netTop - 34, size: 8.5, font: regular, color: COLORS.slate });
  if (hasYtd) {
    page.drawText(`Year-to-Date Gross Earnings: ${formatMoney(data.ytdGross!)}`, { x: MARGIN + 8, y: netTop - 48, size: 7.5, font: regular, color: COLORS.slate });
  }
  hLine(netBottom, MARGIN, MARGIN + CONTENT_W);

  y = netBottom;

  // ── Signature block — seal legible behind, signature sized by its own
  // aspect ratio on top, "signed over the stamp" layering. Both source
  // images are cropped to their actual content (see cropToContent) before
  // reaching here, so this height budget is spent entirely on visible
  // artwork rather than the blank margin the raw PNGs carry. SEAL_H=75 is
  // roughly a real 1in rubber-stamp size — a prior round at 130 (right
  // after the crop fix landed) read as oversized since every point of
  // that height was now real ink instead of mostly padding. The footer
  // is derived from sigBlockBottom below, so resizing these never
  // reintroduces an empty gap underneath. ───────────────────────────────
  const sigTop = y;
  const sigBlockRightX = MARGIN + CONTENT_W - 16;
  const sigLabel = `for ${COMPANY_NAME}`;
  drawRightAligned(sigLabel, sigBlockRightX, sigTop - 16, 9, bold);

  const SEAL_H = 75;
  const sealTopY = sigTop - 22;
  let sealW = 0;
  if (sealImg) {
    const naturalDims = sealImg.scale(1);
    const scale = SEAL_H / naturalDims.height;
    sealW = Math.min(naturalDims.width * scale, CONTENT_W * 0.22);
    page.drawImage(sealImg, {
      x: sigBlockRightX - sealW,
      y: sealTopY - SEAL_H,
      width: sealW,
      height: SEAL_H,
      opacity: 0.55,
    });
  }

  // Signature: sized from its own aspect ratio, drawn opaque over the
  // lower-third of the seal.
  const SIG_MAX_H = 42;
  const SIG_MAX_W = 100;
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
    const lineY = sealTopY - SEAL_H * 0.5;
    page.drawLine({
      start: { x: sigBlockRightX - 110, y: lineY },
      end: { x: sigBlockRightX, y: lineY },
      thickness: 0.75,
      color: COLORS.slate,
      dashArray: [2, 2],
    });
    drawCentered("Signature on file", sigBlockRightX - 55, lineY - 10, 7, regular, COLORS.slate);
    sigImgBottomY = lineY - 10;
  }

  const sigBlockBottom = Math.min(sealTopY - SEAL_H, sigImgBottomY) - 12;
  drawRightAligned("Authorised Signatory", sigBlockRightX, sigBlockBottom, 8, regular, COLORS.slate);

  // ── Footer bar — a thin band immediately below the signature block,
  // not a fixed page-bottom position that leaves a large empty bordered
  // gap when the content above ends early. ──────────────────────────────
  const footerH = 24;
  const footerTop = sigBlockBottom - 10;
  const footerBottom = Math.max(footerTop - footerH, MARGIN + 20);
  page.drawRectangle({ x: MARGIN, y: footerBottom, width: CONTENT_W, height: footerH, color: COLORS.footerBg });
  drawCentered(
    `This is a salary statement issued by ${COMPANY_NAME} for the period indicated above. Confidential — not for circulation.`,
    PAGE_W / 2,
    (footerTop + footerBottom) / 2 - 3,
    7,
    regular,
    COLORS.slate
  );
  hLine(footerTop, MARGIN, MARGIN + CONTENT_W);
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
