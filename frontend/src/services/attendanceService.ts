import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { INTERN_DOMAIN_LABELS } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternAttendance } from "./internService";

function formatDateDDMMYYYY(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function formatMonthYear(date: Date): string {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export interface InternAttendanceData {
  name: string;
  internId: string;
  designation: string;
  department: string;
  collegeName: string;
  collegeAddress: string;
  startPeriod: Date;
  endPeriod: Date;
  totalInternshipDays: number;
  daysPresent: number;
}

export interface EmployeeAttendanceData {
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  month: string;
  year: number;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  leavesTaken: number;
  holidays: number;
}

// ── Colors ──
const navy = rgb(0.12, 0.16, 0.32);
const blue = rgb(0.14, 0.33, 0.60);
const black = rgb(0, 0, 0);
const darkText = rgb(0.15, 0.15, 0.15);
const grayText = rgb(0.35, 0.35, 0.35);
const lightText = rgb(0.5, 0.5, 0.5);
const cellBorder = rgb(0.72, 0.72, 0.72);
const outerBorder = rgb(0.3, 0.3, 0.3);
const headerBg = rgb(0.14, 0.33, 0.60);
const altRowBg = rgb(0.95, 0.96, 0.98);
const white = rgb(1, 1, 1);
const greenVal = rgb(0.1, 0.5, 0.1);
const redVal = rgb(0.7, 0.12, 0.12);
const blueVal = rgb(0.1, 0.35, 0.65);

// ── Font loader ──
async function loadFonts(pdfDoc: PDFDocument) {
  pdfDoc.registerFontkit(fontkit);
  try {
    const [rb, bb] = await Promise.all([
      fetch("/fonts/Poppins-Regular.ttf").then(r => r.arrayBuffer()),
      fetch("/fonts/Poppins-Bold.ttf").then(r => r.arrayBuffer()),
    ]);
    return { regular: await pdfDoc.embedFont(rb), bold: await pdfDoc.embedFont(bb) };
  } catch {
    return { regular: await pdfDoc.embedFont(StandardFonts.Helvetica), bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold) };
  }
}
type Fonts = Awaited<ReturnType<typeof loadFonts>>;

// ── Draw bordered cell ──
function drawCell(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number, y: number, w: number, h: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  opts: {
    fontSize?: number; color?: ReturnType<typeof rgb>;
    bg?: ReturnType<typeof rgb>; align?: "left" | "right" | "center";
    paddingX?: number; borderW?: number; borderC?: ReturnType<typeof rgb>;
  } = {},
) {
  const fs = opts.fontSize ?? 9;
  const px = opts.paddingX ?? 10;
  const bw = opts.borderW ?? 0.5;
  const bc = opts.borderC ?? cellBorder;

  if (opts.bg) page.drawRectangle({ x, y, width: w, height: h, color: opts.bg });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: bc, borderWidth: bw });

  const tw = font.widthOfTextAtSize(text, fs);
  let tx = x + px;
  if (opts.align === "right") tx = x + w - tw - px;
  else if (opts.align === "center") tx = x + (w - tw) / 2;

  page.drawText(text, {
    x: tx, y: y + (h - fs) / 2 - 1,
    size: fs, font, color: opts.color ?? darkText,
  });
}

// ── Draw header with logo ──
async function drawHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  pdfDoc: PDFDocument,
  fonts: Fonts,
  left: number, y: number, contentW: number, _width: number,
): Promise<number> {
  const centerX = left + contentW / 2;

  // Logo (centered)
  const lh = 80;
  try {
    const logoBytes = await fetch("/images/logo-full.png").then(r => r.arrayBuffer());
    const logoImg = await pdfDoc.embedPng(new Uint8Array(logoBytes));
    const lw = lh * (logoImg.width / logoImg.height);
    page.drawImage(logoImg, { x: centerX - lw / 2, y: y - lh, width: lw, height: lh });
  } catch {
    page.drawText("WELBUILT AI SOLUTIONS PVT. LTD.", { x: left + 15, y: y - 30, size: 16, font: fonts.bold, color: navy });
  }

  // Address + contact (centered below logo)
  let cy = y - lh - 12;
  const addr = "23/14 A, Ramalinganar 6th Street, Tiruvannamalai, Tamil Nadu - 606601, India";
  const addrW = fonts.regular.widthOfTextAtSize(addr, 8);
  page.drawText(addr, { x: centerX - addrW / 2, y: cy, size: 8, font: fonts.regular, color: grayText });

  cy -= 13;
  const contact = "Phone: +91 6381142016  |  Email: welbuiltai@gmail.com";
  const ctW = fonts.regular.widthOfTextAtSize(contact, 8);
  page.drawText(contact, { x: centerX - ctW / 2, y: cy, size: 8, font: fonts.regular, color: grayText });

  // Divider line
  cy -= 10;
  page.drawRectangle({ x: left, y: cy, width: contentW, height: 1.5, color: navy });

  return cy - 8;
}

// ── Draw signatory with seal behind (offer letter style) ──
async function drawSignatory(
  page: ReturnType<PDFDocument["addPage"]>,
  pdfDoc: PDFDocument,
  fonts: Fonts,
  y: number, left: number,
): Promise<number> {
  // Seal FIRST (rendered behind text)
  try {
    const sealBytes = await fetch("/images/seal.png").then(r => r.arrayBuffer());
    const sealImg = await pdfDoc.embedPng(new Uint8Array(sealBytes));
    const sw = 150;
    const sh = sw * (607 / 411);
    page.drawImage(sealImg, { x: left + 10, y: y - sh + 60, width: sw, height: sh, opacity: 0.15 });
  } catch { /* no seal */ }

  // Text ON TOP of seal
  const fs = 10;
  const lh = 16;
  page.drawText("Warm Regards,", { x: left, y, size: fs, font: fonts.regular, color: black });
  y -= 20;
  page.drawText("Welbuilt AI Solutions Pvt Ltd", { x: left, y, size: fs, font: fonts.bold, color: black });
  y -= lh;
  page.drawText("Baranitharan S", { x: left, y, size: fs, font: fonts.bold, color: black });
  y -= lh;
  page.drawText("Chief Operational Officer (COO)", { x: left, y, size: fs, font: fonts.regular, color: black });
  y -= lh;
  page.drawText("HR Department", { x: left, y, size: fs, font: fonts.regular, color: black });
  return y;
}

// ═══════════════════════════════════════════════════════
// INTERN ATTENDANCE PDF
// ═══════════════════════════════════════════════════════
export async function generateInternAttendancePdf(data: InternAttendanceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const margin = 40;
  const left = margin;
  const contentW = width - margin * 2;
  let y = height - margin;

  // ── OUTER BORDER ──
  page.drawRectangle({
    x: margin - 5, y: margin - 5,
    width: contentW + 10, height: height - margin * 2 + 10,
    borderColor: outerBorder, borderWidth: 1.5,
  });

  // ── HEADER ──
  y = await drawHeader(page, pdfDoc, fonts, left, y, contentW, width);

  // Thick divider
  page.drawRectangle({ x: left, y, width: contentW, height: 2.5, color: blue });
  y -= 2.5;

  // ── TITLE BAND ──
  const titleH = 30;
  y -= titleH;
  page.drawRectangle({ x: left, y, width: contentW, height: titleH, color: headerBg });
  const title = "INTERNSHIP ATTENDANCE REPORT";
  const tw = fonts.bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (width - tw) / 2, y: y + 9, size: 13, font: fonts.bold, color: white });

  // Period subtitle
  y -= 18;
  const period = `Period: ${formatMonthYear(data.startPeriod)} to ${formatMonthYear(data.endPeriod)}`;
  const pw = fonts.regular.widthOfTextAtSize(period, 9);
  page.drawText(period, { x: (width - pw) / 2, y, size: 9, font: fonts.regular, color: grayText });

  // ── EMPLOYEE DETAILS TABLE (4-column bordered grid) ──
  y -= 18;
  const rowH = 22;
  const halfW = contentW / 2;
  const labelW = halfW * 0.42;
  const valueW = halfW * 0.58;

  const detailRows: [string, string, string, string][] = [
    ["Employee Name", data.name, "Intern ID", data.internId],
    ["Designation", data.designation, "Department", data.department],
    ["College", data.collegeName, "", ""],
    ...(data.collegeAddress ? [["College Address", data.collegeAddress, "", ""] as [string, string, string, string]] : []),
    ["Start Date", formatDateDDMMYYYY(data.startPeriod), "End Date", formatDateDDMMYYYY(data.endPeriod)],
  ];

  for (const [l1, v1, l2, v2] of detailRows) {
    y -= rowH;
    const bg = undefined;
    drawCell(page, l1, left, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText, bg });
    if (l2) {
      drawCell(page, v1, left + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9, bg });
      drawCell(page, l2, left + halfW, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText, bg });
      drawCell(page, v2, left + halfW + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9, bg });
    } else {
      // Full-width value spanning 3 cells
      drawCell(page, v1, left + labelW, y, contentW - labelW, rowH, fonts.regular, { fontSize: 9, bg });
    }
  }

  // ── ATTENDANCE SUMMARY SECTION ──
  y -= 25;
  page.drawText("Attendance Summary", { x: left, y, size: 11, font: fonts.bold, color: blue });
  y -= 4;
  page.drawRectangle({ x: left, y, width: contentW, height: 1.5, color: blue });

  // Summary table
  const absent = data.totalInternshipDays - data.daysPresent;
  const pct = data.totalInternshipDays > 0 ? ((data.daysPresent / data.totalInternshipDays) * 100).toFixed(1) : "0.0";

  const summaryRows: [string, string, ReturnType<typeof rgb>?][] = [
    ["Total Internship Days", data.totalInternshipDays.toString()],
    ["Days Present", data.daysPresent.toString(), greenVal],
    ["Days Absent", absent.toString(), redVal],
    ["Attendance Percentage", `${pct}%`, blueVal],
  ];

  const summaryLabelW = contentW * 0.6;
  const summaryValW = contentW * 0.4;
  const sRowH = 26;

  // Header row
  y -= sRowH;
  drawCell(page, "Particulars", left, y, summaryLabelW, sRowH, fonts.bold, { fontSize: 9, color: white, bg: headerBg, align: "left" });
  drawCell(page, "Details", left + summaryLabelW, y, summaryValW, sRowH, fonts.bold, { fontSize: 9, color: white, bg: headerBg, align: "center" });

  for (let i = 0; i < summaryRows.length; i++) {
    const [label, value, valColor] = summaryRows[i];
    const bg = i % 2 === 0 ? white : altRowBg;
    y -= sRowH;
    drawCell(page, label, left, y, summaryLabelW, sRowH, fonts.regular, { fontSize: 9, bg });
    drawCell(page, value, left + summaryLabelW, y, summaryValW, sRowH, fonts.bold, { fontSize: 11, color: valColor ?? darkText, bg, align: "center" });
  }

  // ── SIGNATORY ──
  y -= 40;
  page.drawRectangle({ x: left, y: y + 12, width: contentW, height: 1, color: cellBorder });
  y -= 5;
  const sigEnd = await drawSignatory(page, pdfDoc, fonts, y, left);

  // Disclaimer
  const disc = "This is a computer-generated document and does not require a physical signature.";
  const dw = fonts.regular.widthOfTextAtSize(disc, 7);
  page.drawText(disc, { x: (width - dw) / 2, y: sigEnd - 18, size: 7, font: fonts.regular, color: lightText });

  return pdfDoc.save();
}

// ═══════════════════════════════════════════════════════
// EMPLOYEE ATTENDANCE PDF
// ═══════════════════════════════════════════════════════
export async function generateEmployeeAttendancePdf(data: EmployeeAttendanceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const margin = 40;
  const left = margin;
  const contentW = width - margin * 2;
  let y = height - margin;

  // Outer border
  page.drawRectangle({
    x: margin - 5, y: margin - 5,
    width: contentW + 10, height: height - margin * 2 + 10,
    borderColor: outerBorder, borderWidth: 1.5,
  });

  // Header
  y = await drawHeader(page, pdfDoc, fonts, left, y, contentW, width);
  page.drawRectangle({ x: left, y, width: contentW, height: 2.5, color: blue });
  y -= 2.5;

  // Title band
  const titleH = 30;
  y -= titleH;
  page.drawRectangle({ x: left, y, width: contentW, height: titleH, color: headerBg });
  const title = "MONTHLY ATTENDANCE REPORT";
  const tw = fonts.bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (width - tw) / 2, y: y + 9, size: 13, font: fonts.bold, color: white });

  y -= 18;
  const period = `For the month of ${data.month} ${data.year}`;
  const pw = fonts.regular.widthOfTextAtSize(period, 9);
  page.drawText(period, { x: (width - pw) / 2, y, size: 9, font: fonts.regular, color: grayText });

  // Employee details table
  y -= 18;
  const rowH = 22;
  const halfW = contentW / 2;
  const labelW = halfW * 0.42;
  const valueW = halfW * 0.58;

  const details: [string, string, string, string][] = [
    ["Employee Name", data.name, "Employee ID", data.employeeId],
    ["Designation", data.designation, "Department", data.department],
  ];

  for (const [l1, v1, l2, v2] of details) {
    y -= rowH;
    drawCell(page, l1, left, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText });
    drawCell(page, v1, left + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9 });
    drawCell(page, l2, left + halfW, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText });
    drawCell(page, v2, left + halfW + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9 });
  }

  // Attendance summary
  y -= 25;
  page.drawText("Attendance Summary", { x: left, y, size: 11, font: fonts.bold, color: blue });
  y -= 4;
  page.drawRectangle({ x: left, y, width: contentW, height: 1.5, color: blue });

  const pct = data.totalWorkingDays > 0 ? ((data.daysPresent / data.totalWorkingDays) * 100).toFixed(1) : "0.0";

  const summaryRows: [string, string, ReturnType<typeof rgb>?][] = [
    ["Total Working Days", data.totalWorkingDays.toString()],
    ["Days Present", data.daysPresent.toString(), greenVal],
    ["Days Absent", data.daysAbsent.toString(), redVal],
    ["Leaves Taken", data.leavesTaken.toString()],
    ["Public Holidays", data.holidays.toString()],
    ["Attendance Percentage", `${pct}%`, blueVal],
  ];

  const sLabelW = contentW * 0.6;
  const sValW = contentW * 0.4;
  const sRowH = 26;

  y -= sRowH;
  drawCell(page, "Particulars", left, y, sLabelW, sRowH, fonts.bold, { fontSize: 9, color: white, bg: headerBg, align: "left" });
  drawCell(page, "Details", left + sLabelW, y, sValW, sRowH, fonts.bold, { fontSize: 9, color: white, bg: headerBg, align: "center" });

  for (let i = 0; i < summaryRows.length; i++) {
    const [label, value, valColor] = summaryRows[i];
    const bg = i % 2 === 0 ? white : altRowBg;
    y -= sRowH;
    drawCell(page, label, left, y, sLabelW, sRowH, fonts.regular, { fontSize: 9, bg });
    drawCell(page, value, left + sLabelW, y, sValW, sRowH, fonts.bold, { fontSize: 11, color: valColor ?? darkText, bg, align: "center" });
  }

  // Signatory
  y -= 40;
  page.drawRectangle({ x: left, y: y + 12, width: contentW, height: 1, color: cellBorder });
  y -= 5;
  const sigEnd = await drawSignatory(page, pdfDoc, fonts, y, left);

  const disc = "This is a computer-generated document and does not require a physical signature.";
  const dw = fonts.regular.widthOfTextAtSize(disc, 7);
  page.drawText(disc, { x: (width - dw) / 2, y: sigEnd - 18, size: 7, font: fonts.regular, color: lightText });

  return pdfDoc.save();
}

// ═══════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════

export async function generateAndDownloadAttendance(
  intern: Intern,
  formData: { totalInternshipDays: number; daysPresent: number; collegeAddress: string }
): Promise<void> {
  const data: InternAttendanceData = {
    name: intern.name, internId: intern.internId,
    designation: `Intern - ${INTERN_DOMAIN_LABELS[intern.domain]}`, department: "IT",
    collegeName: intern.college, collegeAddress: formData.collegeAddress,
    startPeriod: intern.startDate, endPeriod: intern.endDate,
    totalInternshipDays: formData.totalInternshipDays, daysPresent: formData.daysPresent,
  };
  const bytes = await generateInternAttendancePdf(data);
  saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Attendance.pdf`);
}

export async function generateAndUploadAttendance(
  intern: Intern & { id: string },
  formData: { totalInternshipDays: number; daysPresent: number; collegeAddress: string }
): Promise<{ attendanceUrl: string; attendanceKey: string }> {
  const data: InternAttendanceData = {
    name: intern.name, internId: intern.internId,
    designation: `Intern - ${INTERN_DOMAIN_LABELS[intern.domain]}`, department: "IT",
    collegeName: intern.college, collegeAddress: formData.collegeAddress,
    startPeriod: intern.startDate, endPeriod: intern.endDate,
    totalInternshipDays: formData.totalInternshipDays, daysPresent: formData.daysPresent,
  };
  const bytes = await generateInternAttendancePdf(data);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const file = new File([blob], `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Attendance.pdf`, { type: "application/pdf" });
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/attendance");
  await updateInternAttendance(intern.id, fileUrl, fileKey);
  return { attendanceUrl: fileUrl, attendanceKey: fileKey };
}

export async function generateAndDownloadEmployeeAttendance(data: EmployeeAttendanceData): Promise<void> {
  const bytes = await generateEmployeeAttendancePdf(data);
  saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `Attendance_${data.name.replace(/\s+/g, "_")}_${data.month}_${data.year}.pdf`);
}

export async function bulkGenerateAttendance(
  interns: Array<Intern & { id: string } & { totalInternshipDays: number; daysPresent: number; collegeAddress: string }>,
  onProgress?: (current: number, total: number, internName: string) => void
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];
  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    try {
      if (onProgress) onProgress(i + 1, interns.length, intern.name);
      await generateAndUploadAttendance(intern, { totalInternshipDays: intern.totalInternshipDays, daysPresent: intern.daysPresent, collegeAddress: intern.collegeAddress });
      results.push({ internId: intern.internId, success: true });
    } catch (error) {
      results.push({ internId: intern.internId, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}
