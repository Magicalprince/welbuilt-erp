import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternPayslip } from "./internService";
import { numberToWords } from "./payslipService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLong(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.arrayBuffer() : null;
  } catch { return null; }
}

function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Data interface ────────────────────────────────────────────────────────────

export interface SparksPayslipData {
  name: string;
  internId: string;
  domain: string;
  college: string;
  collegeAddress: string;
  startDate: Date;
  endDate: Date;
  referenceNumber: string;
  monthlyStipend: number;
  numberOfMonths: number;
  paymentType: "MONTHLY" | "ONE_TIME";
  month: string;
  year: number;
}

// ── Core PDF generator ────────────────────────────────────────────────────────

export async function generateSparksPayslipPdf(data: SparksPayslipData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const W = 595.28;
  const H = 841.89;
  const page = pdfDoc.addPage([W, H]);

  // ── Fonts ─────────────────────────────────────────────────────────────────
  let regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  try {
    const [rb, bb] = await Promise.all([
      fetchBytes("/fonts/Poppins-Regular.ttf"),
      fetchBytes("/fonts/Poppins-Bold.ttf"),
    ]);
    if (rb) regular = await pdfDoc.embedFont(rb);
    if (bb) bold = await pdfDoc.embedFont(bb);
  } catch { /* fallback */ }

  // ── Colours — teal/gold — distinct from WelBuilt's amber/blue scheme ──────
  const offWhite  = rgb(0.961, 0.941, 0.910);
  const teal      = rgb(0.051, 0.361, 0.388);   // #0D5C63
  const tealDim   = rgb(0.051, 0.361, 0.388);
  const gold      = rgb(0.784, 0.647, 0.078);   // #C8A514
  const goldBg    = rgb(0.784, 0.647, 0.078);
  const dark      = rgb(0.10,  0.10,  0.10);
  const mid       = rgb(0.40,  0.40,  0.40);
  const white     = rgb(1, 1, 1);
  const green     = rgb(0.08,  0.50,  0.22);
  const greenBg   = rgb(0.88,  0.96,  0.89);
  const greenBdr  = rgb(0.15,  0.55,  0.25);
  const rowAlt    = rgb(0.051, 0.361, 0.388);

  // ── Background ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: offWhite });

  // ── Header band ───────────────────────────────────────────────────────────
  const headerH = 110;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: teal });
  page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: gold });

  const logoBytes = await fetchBytes("/images/sparks/logo.png");
  if (logoBytes) {
    const logoImg = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImg.scale(0.22);
    page.drawImage(logoImg, { x: 28, y: H - headerH + (headerH - logoDims.height) / 2, width: logoDims.width, height: logoDims.height });
  } else {
    page.drawText("⚡ SPARKS AI", { x: 28, y: H - 55, size: 16, font: bold, color: white });
  }

  page.drawText("SPARKS AI SOLUTIONS", { x: 200, y: H - 38, size: 13, font: bold, color: white });
  page.drawText("A Brand under WelBuilt AI Solutions Pvt. Ltd.", { x: 200, y: H - 52, size: 7.5, font: regular, color: white, opacity: 0.75 });
  page.drawText("23/14 A, Ramalinganar 6th Street, Tiruvannamalai, Tamil Nadu – 606601", { x: 200, y: H - 63, size: 7, font: regular, color: white, opacity: 0.65 });

  // Document label
  page.drawText("STIPEND SLIP", { x: W - 125, y: H - 38, size: 12, font: bold, color: gold });
  page.drawText(`${data.month} ${data.year}`, { x: W - 125, y: H - 52, size: 8, font: regular, color: white, opacity: 0.8 });
  if (data.referenceNumber) {
    page.drawText(`Ref: ${data.referenceNumber}`, { x: W - 125, y: H - 64, size: 7, font: regular, color: white, opacity: 0.7 });
  }

  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: 3, color: gold });

  const LM = 32;
  const RM = W - 32;
  const CW = RM - LM;
  let Y = H - headerH - 22;

  // ── Section title helper ──────────────────────────────────────────────────
  const drawSection = (title: string) => {
    page.drawRectangle({ x: LM, y: Y - 2, width: CW, height: 20, color: teal });
    page.drawRectangle({ x: LM, y: Y - 2, width: 4, height: 20, color: gold });
    page.drawText(title, { x: LM + 10, y: Y + 4, size: 8.5, font: bold, color: white });
    Y -= 26;
  };

  // ── Intern Details ────────────────────────────────────────────────────────
  drawSection("INTERN DETAILS");

  const details: [string, string][] = [
    ["Name",             data.name],
    ["Intern ID",        data.internId],
    ["Domain / Role",    data.domain],
    ["College",          data.college],
    ["College Address",  data.collegeAddress || "—"],
    ["Internship From",  formatLong(data.startDate)],
    ["Internship To",    formatLong(data.endDate)],
  ];

  const rowH = 17;
  const labelX = LM + 8;
  const valueX = LM + 160;

  for (let i = 0; i < details.length; i++) {
    const rowY = Y - i * rowH;
    if (i % 2 === 0) {
      page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: rowH, color: rowAlt, opacity: 0.07 });
    }
    page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: 0.5, color: teal, opacity: 0.12 });
    page.drawText(details[i][0], { x: labelX, y: rowY, size: 8.5, font: bold, color: mid });
    page.drawText(details[i][1], { x: valueX, y: rowY, size: 8.5, font: regular, color: dark });
  }
  Y -= details.length * rowH + 16;

  // ── Stipend Details ───────────────────────────────────────────────────────
  drawSection("STIPEND DETAILS");

  const total = data.paymentType === "MONTHLY"
    ? data.monthlyStipend * data.numberOfMonths
    : data.monthlyStipend;

  const stipendRows: [string, string][] = [
    ["Payment Type",      data.paymentType === "MONTHLY" ? "Monthly Stipend" : "One-Time Payment"],
    ["Monthly Stipend",   formatINR(data.monthlyStipend)],
    ...(data.paymentType === "MONTHLY"
      ? [["No. of Months", String(data.numberOfMonths)] as [string, string]]
      : []),
    ["Period",            `${data.month} ${data.year}`],
  ];

  const sRowH = 20;
  for (let i = 0; i < stipendRows.length; i++) {
    const rowY = Y - i * sRowH;
    if (i % 2 === 0) {
      page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: sRowH, color: rowAlt, opacity: 0.07 });
    }
    page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: 0.5, color: teal, opacity: 0.1 });
    page.drawText(stipendRows[i][0], { x: labelX, y: rowY, size: 9, font: bold, color: mid });
    page.drawText(stipendRows[i][1], { x: valueX, y: rowY, size: 9, font: regular, color: dark });
  }
  Y -= stipendRows.length * sRowH + 4;

  // ── Total row (gold highlight) ────────────────────────────────────────────
  page.drawRectangle({ x: LM, y: Y - 6, width: CW, height: 24, color: goldBg, opacity: 0.18 });
  page.drawRectangle({ x: LM, y: Y - 6, width: 4, height: 24, color: gold });
  page.drawRectangle({ x: LM, y: Y + 16, width: CW, height: 1.5, color: gold, opacity: 0.5 });
  page.drawText("TOTAL STIPEND", { x: labelX, y: Y + 4, size: 9, font: bold, color: teal });
  page.drawText(formatINR(total), { x: valueX, y: Y + 4, size: 11, font: bold, color: teal });
  Y -= 34;

  // ── Net Payment box ───────────────────────────────────────────────────────
  const boxH = 52;
  page.drawRectangle({ x: LM, y: Y - boxH, width: CW, height: boxH, color: greenBg });
  page.drawRectangle({ x: LM, y: Y - boxH, width: CW, height: boxH, borderColor: greenBdr, borderWidth: 1.5, color: greenBg });
  page.drawText("Net Stipend Payable", { x: LM + 12, y: Y - 16, size: 9, font: bold, color: green });
  page.drawText(formatINR(total), { x: LM + 12, y: Y - 30, size: 20, font: bold, color: green });
  // Amount in words
  const words = numberToWords(total);
  page.drawText(words, { x: LM + 12, y: Y - 44, size: 7.5, font: regular, color: green, opacity: 0.85 });
  Y -= boxH + 20;

  // ── Signature + Seal ──────────────────────────────────────────────────────
  const sigX = W - 200;

  const sigBytes = await fetchBytes("/images/sparks/signature.png");
  if (sigBytes) {
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImg.scale(0.20);
    page.drawImage(sigImg, { x: sigX, y: Y - sigDims.height + 10, width: sigDims.width, height: sigDims.height });
  }

  const sealBytes = await fetchBytes("/images/sparks/seal.png");
  if (sealBytes) {
    const sealImg = await pdfDoc.embedPng(sealBytes);
    const sealDims = sealImg.scale(0.18);
    page.drawImage(sealImg, {
      x: sigX + 100,
      y: Y - sealDims.height + 10,
      width: sealDims.width,
      height: sealDims.height,
      opacity: 0.88,
    });
  }

  page.drawRectangle({ x: sigX, y: Y - 34, width: 120, height: 0.75, color: teal });
  page.drawText("Ramachandraa P S", { x: sigX, y: Y - 46, size: 9, font: bold, color: teal });
  page.drawText("Director, Sparks AI Solutions", { x: sigX, y: Y - 58, size: 7.5, font: regular, color: mid });

  page.drawText(`Issued on: ${formatLong(new Date())}`, { x: LM, y: Y - 46, size: 8, font: regular, color: mid });

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 30, width: W, height: 3, color: gold });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 30, color: tealDim });
  page.drawText(
    "This is a computer-generated stipend slip. Sparks AI Solutions — A Brand under WelBuilt AI Solutions Pvt. Ltd.",
    { x: LM, y: 10, size: 6.5, font: regular, color: white, opacity: 0.65 },
  );

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateAndDownloadSparksPayslip(
  intern: Intern,
  formData: {
    referenceNumber: string;
    monthlyStipend: number;
    numberOfMonths: number;
    paymentType: "MONTHLY" | "ONE_TIME";
    month: string;
    year: number;
    collegeAddress?: string;
  },
  filename?: string,
): Promise<void> {
  const pdfBytes = await generateSparksPayslipPdf({
    name: intern.name,
    internId: intern.internId,
    domain: intern.domain,
    college: intern.college,
    collegeAddress: formData.collegeAddress ?? "",
    startDate: intern.startDate,
    endDate: intern.endDate,
    referenceNumber: formData.referenceNumber,
    monthlyStipend: formData.monthlyStipend,
    numberOfMonths: formData.numberOfMonths,
    paymentType: formData.paymentType,
    month: formData.month,
    year: formData.year,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, filename ?? `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_StipendSlip.pdf`);
}

export async function generateAndUploadSparksPayslip(
  intern: Intern & { id: string },
  formData: {
    referenceNumber: string;
    monthlyStipend: number;
    numberOfMonths: number;
    paymentType: "MONTHLY" | "ONE_TIME";
    month: string;
    year: number;
    collegeAddress?: string;
  },
): Promise<{ payslipUrl: string; payslipKey: string }> {
  const pdfBytes = await generateSparksPayslipPdf({
    name: intern.name,
    internId: intern.internId,
    domain: intern.domain,
    college: intern.college,
    collegeAddress: formData.collegeAddress ?? "",
    startDate: intern.startDate,
    endDate: intern.endDate,
    referenceNumber: formData.referenceNumber,
    monthlyStipend: formData.monthlyStipend,
    numberOfMonths: formData.numberOfMonths,
    paymentType: formData.paymentType,
    month: formData.month,
    year: formData.year,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const fileName = `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_StipendSlip.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/payslips/sparks");

  await updateInternPayslip(intern.id, fileUrl, fileKey);
  return { payslipUrl: fileUrl, payslipKey: fileKey };
}

export async function bulkGenerateSparksPayslips(
  interns: Array<Intern & { id: string }>,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const now = new Date();
  const month = now.toLocaleDateString("en-IN", { month: "long" });
  const year = now.getFullYear();
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    try {
      onProgress?.(i + 1, interns.length, intern.name);
      await generateAndUploadSparksPayslip(intern, {
        referenceNumber: intern.referenceNumber ?? `SP${intern.internId}`,
        monthlyStipend: intern.stipend ?? 0,
        numberOfMonths: intern.numberOfMonths ?? 1,
        paymentType: intern.paymentType ?? "MONTHLY",
        month,
        year,
        collegeAddress: "",
      });
      results.push({ internId: intern.internId, success: true });
    } catch (err) {
      results.push({ internId: intern.internId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return results;
}
