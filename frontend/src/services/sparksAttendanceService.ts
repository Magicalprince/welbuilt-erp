import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternAttendance } from "./internService";

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

// ── Data interface ────────────────────────────────────────────────────────────

export interface SparksAttendanceData {
  name: string;
  internId: string;
  college: string;
  domain: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  daysPresent: number;
  month: string;   // e.g. "June 2026"
}

// ── Core PDF generator ────────────────────────────────────────────────────────

export async function generateSparksAttendancePdf(data: SparksAttendanceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // A4 portrait
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

  // ── Colours — teal/gold palette ──────────────────────────────────────────
  const offWhite  = rgb(0.961, 0.941, 0.910);  // warm page bg
  const teal      = rgb(0.051, 0.361, 0.388);  // #0D5C63
  const tealLight = rgb(0.051, 0.361, 0.388);
  const gold      = rgb(0.784, 0.647, 0.078);  // #C8A514
  const dark      = rgb(0.10,  0.10,  0.10);
  const mid       = rgb(0.40,  0.40,  0.40);
  const white     = rgb(1, 1, 1);
  const green     = rgb(0.08,  0.50,  0.22);
  const red       = rgb(0.72,  0.10,  0.10);
  const rowAlt    = rgb(0.051, 0.361, 0.388);  // teal for alt rows (low opacity)

  // ── Background ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: offWhite });

  // ── Header band ───────────────────────────────────────────────────────────
  const headerH = 110;
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: headerH, color: teal });

  // Gold top border
  page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: gold });

  // Logo
  const logoBytes = await fetchBytes("/images/sparks/logo.png");
  if (logoBytes) {
    const logoImg = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImg.scale(0.22);
    page.drawImage(logoImg, { x: 28, y: H - headerH + (headerH - logoDims.height) / 2, width: logoDims.width, height: logoDims.height });
  } else {
    page.drawText("⚡ SPARKS AI", { x: 28, y: H - 55, size: 16, font: bold, color: white });
  }

  // Company name + tagline
  page.drawText("SPARKS AI SOLUTIONS", { x: 200, y: H - 38, size: 13, font: bold, color: white });
  page.drawText("A Brand under WelBuilt AI Solutions Pvt. Ltd.", { x: 200, y: H - 52, size: 7.5, font: regular, color: white, opacity: 0.75 });
  page.drawText("23/14 A, Ramalinganar 6th Street, Tiruvannamalai, Tamil Nadu – 606601", { x: 200, y: H - 63, size: 7, font: regular, color: white, opacity: 0.65 });

  // Document title on right of header
  page.drawText("ATTENDANCE REPORT", { x: W - 155, y: H - 38, size: 11, font: bold, color: gold });
  page.drawText(`Period: ${data.month}`, { x: W - 155, y: H - 52, size: 7.5, font: regular, color: white, opacity: 0.8 });

  // Gold divider at header bottom
  page.drawRectangle({ x: 0, y: H - headerH, width: W, height: 3, color: gold });

  let Y = H - headerH - 22;
  const LM = 32;  // left margin
  const RM = W - 32; // right margin
  const CW = RM - LM;

  // ── Section title helper ──────────────────────────────────────────────────
  const drawSection = (title: string) => {
    page.drawRectangle({ x: LM, y: Y - 2, width: CW, height: 20, color: teal });
    page.drawRectangle({ x: LM, y: Y - 2, width: 4, height: 20, color: gold });
    page.drawText(title, { x: LM + 10, y: Y + 4, size: 8.5, font: bold, color: white });
    Y -= 26;
  };

  // ── Intern Details ────────────────────────────────────────────────────────
  drawSection("INTERN DETAILS");

  const detailCols = [
    ["Name", data.name],
    ["Intern ID", data.internId],
    ["College", data.college],
    ["Domain / Role", data.domain],
    ["Internship From", formatLong(data.startDate)],
    ["Internship To", formatLong(data.endDate)],
  ];

  const detailRowH = 18;
  const labelX = LM + 8;
  const valueX = LM + 160;

  for (let i = 0; i < detailCols.length; i++) {
    const rowY = Y - i * detailRowH;
    if (i % 2 === 0) {
      page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: detailRowH, color: rowAlt, opacity: 0.07 });
    }
    page.drawRectangle({ x: LM, y: rowY - 4, width: CW, height: 0.5, color: teal, opacity: 0.12 });
    page.drawText(detailCols[i][0], { x: labelX, y: rowY, size: 8.5, font: bold, color: mid });
    page.drawText(detailCols[i][1], { x: valueX, y: rowY, size: 8.5, font: regular, color: dark });
  }
  Y -= detailCols.length * detailRowH + 16;

  // ── Attendance Summary ────────────────────────────────────────────────────
  drawSection("ATTENDANCE SUMMARY");

  const absent = Math.max(0, data.totalDays - data.daysPresent);
  const pct = data.totalDays > 0 ? ((data.daysPresent / data.totalDays) * 100).toFixed(1) : "0.0";
  const pctNum = parseFloat(pct);

  const summaryRows: [string, string, import("pdf-lib").Color][] = [
    ["Total Working Days",  String(data.totalDays),  dark],
    ["Days Present",        String(data.daysPresent), green],
    ["Days Absent",         String(absent),           absent > 0 ? red : dark],
    ["Attendance %",        `${pct}%`,                pctNum >= 75 ? green : red],
  ];

  const sumRowH = 22;
  const sumLabelX = LM + 8;
  const sumValX   = W - 80;

  for (let i = 0; i < summaryRows.length; i++) {
    const rowY = Y - i * sumRowH;
    if (i % 2 === 0) {
      page.drawRectangle({ x: LM, y: rowY - 5, width: CW, height: sumRowH, color: teal, opacity: 0.05 });
    }
    page.drawRectangle({ x: LM, y: rowY + sumRowH - 5, width: CW, height: 0.5, color: teal, opacity: 0.1 });
    page.drawText(summaryRows[i][0], { x: sumLabelX, y: rowY, size: 9, font: bold, color: mid });
    page.drawText(summaryRows[i][1], { x: sumValX, y: rowY, size: 11, font: bold, color: summaryRows[i][2] });
  }
  Y -= summaryRows.length * sumRowH + 16;

  // ── Attendance % visual bar ───────────────────────────────────────────────
  const barW = CW;
  const barH2 = 14;
  page.drawRectangle({ x: LM, y: Y - barH2, width: barW, height: barH2, color: rgb(0.85, 0.85, 0.85) });
  const fillW = Math.max(0, Math.min(barW, (pctNum / 100) * barW));
  page.drawRectangle({ x: LM, y: Y - barH2, width: fillW, height: barH2, color: pctNum >= 75 ? green : red });
  page.drawText(`${pct}% Attendance`, {
    x: LM + 5, y: Y - barH2 + 3,
    size: 7, font: bold, color: white,
  });
  Y -= barH2 + 18;

  // ── Certificate of Attendance paragraph ──────────────────────────────────
  drawSection("CERTIFICATION");

  const certText =
    `This is to certify that ${data.name} (ID: ${data.internId}), an intern at Sparks AI Solutions in the ` +
    `${data.domain} domain from ${formatLong(data.startDate)} to ${formatLong(data.endDate)}, ` +
    `attended ${data.daysPresent} out of ${data.totalDays} working days during ${data.month}, ` +
    `achieving an attendance of ${pct}%.`;

  const words = certText.split(" ");
  const lineMaxW = CW - 10;
  let line = "";
  const certLines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (regular.widthOfTextAtSize(test, 9) > lineMaxW && line) {
      certLines.push(line); line = w;
    } else { line = test; }
  }
  if (line) certLines.push(line);
  for (const cl of certLines) {
    page.drawText(cl, { x: LM + 6, y: Y, size: 9, font: regular, color: dark });
    Y -= 14;
  }
  Y -= 12;

  // ── Signature + Seal ──────────────────────────────────────────────────────
  const sigX = W - 200;
  const sigStartY = Y;

  // Signature image
  const sigBytes = await fetchBytes("/images/sparks/signature.png");
  if (sigBytes) {
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImg.scale(0.20);
    page.drawImage(sigImg, { x: sigX, y: sigStartY - sigDims.height + 10, width: sigDims.width, height: sigDims.height });
  }

  // Seal
  const sealBytes = await fetchBytes("/images/sparks/seal.png");
  if (sealBytes) {
    const sealImg = await pdfDoc.embedPng(sealBytes);
    const sealDims = sealImg.scale(0.18);
    page.drawImage(sealImg, {
      x: sigX + 100,
      y: sigStartY - sealDims.height + 10,
      width: sealDims.width,
      height: sealDims.height,
      opacity: 0.88,
    });
  }

  page.drawRectangle({ x: sigX, y: sigStartY - 35, width: 120, height: 0.75, color: teal });
  page.drawText("Ramachandraa P S", { x: sigX, y: sigStartY - 47, size: 9, font: bold, color: teal });
  page.drawText("Director, Sparks AI Solutions", { x: sigX, y: sigStartY - 59, size: 7.5, font: regular, color: mid });

  // Issue date on left
  page.drawText(`Issued on: ${formatLong(new Date())}`, { x: LM, y: sigStartY - 47, size: 8, font: regular, color: mid });

  // ── Footer ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 30, width: W, height: 3, color: gold });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 30, color: tealLight });
  page.drawText(
    "This is a computer-generated attendance report. Sparks AI Solutions — A Brand under WelBuilt AI Solutions Pvt. Ltd.",
    { x: LM, y: 10, size: 6.5, font: regular, color: white, opacity: 0.65 },
  );

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateAndDownloadSparksAttendance(
  intern: Intern,
  formData: { totalDays: number; daysPresent: number; month: string },
  filename?: string,
): Promise<void> {
  const pdfBytes = await generateSparksAttendancePdf({
    name: intern.name,
    internId: intern.internId,
    college: intern.college,
    domain: intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    totalDays: formData.totalDays,
    daysPresent: formData.daysPresent,
    month: formData.month,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, filename ?? `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Attendance.pdf`);
}

export async function generateAndUploadSparksAttendance(
  intern: Intern & { id: string },
  formData: { totalDays: number; daysPresent: number; month: string },
): Promise<{ attendanceUrl: string; attendanceKey: string }> {
  const pdfBytes = await generateSparksAttendancePdf({
    name: intern.name,
    internId: intern.internId,
    college: intern.college,
    domain: intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    totalDays: formData.totalDays,
    daysPresent: formData.daysPresent,
    month: formData.month,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const fileName = `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Attendance.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/attendance/sparks");
  await updateInternAttendance(intern.id, fileUrl, fileKey);
  return { attendanceUrl: fileUrl, attendanceKey: fileKey };
}

export async function bulkGenerateSparksAttendance(
  interns: Array<Intern & { id: string }>,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const now = new Date();
  const month = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    try {
      onProgress?.(i + 1, interns.length, intern.name);
      const totalDays = intern.totalInternshipDays ?? 22;
      const daysPresent = intern.daysPresent ?? totalDays;
      await generateAndUploadSparksAttendance(intern, { totalDays, daysPresent, month });
      results.push({ internId: intern.internId, success: true });
    } catch (err) {
      results.push({ internId: intern.internId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return results;
}
