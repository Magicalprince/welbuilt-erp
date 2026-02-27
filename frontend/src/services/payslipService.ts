import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternPayslip } from "./internService";

function formatDateDDMMYYYY(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function cvt(n: number): string {
    let r = "";
    if (n >= 100) { r += ones[Math.floor(n / 100)] + " Hundred"; n %= 100; if (n > 0) r += " "; }
    if (n >= 20) { r += tens[Math.floor(n / 10)]; n %= 10; if (n > 0) r += " " + ones[n]; }
    else if (n > 0) r += ones[n];
    return r;
  }
  let result = "";
  const abs = Math.abs(Math.floor(num));
  if (abs >= 10000000) result += cvt(Math.floor(abs / 10000000)) + " Crore ";
  const lakh = Math.floor((abs % 10000000) / 100000);
  if (lakh > 0) result += cvt(lakh) + " Lakh ";
  const thou = Math.floor((abs % 100000) / 1000);
  if (thou > 0) result += cvt(thou) + " Thousand ";
  const rem = abs % 1000;
  if (rem > 0) result += cvt(rem);
  result = result.trim();
  if (num < 0) result = "Minus " + result;
  return `Rupees ${result} Only`;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export interface InternPayslipData {
  name: string; internId: string; designation: string; department: string;
  collegeName: string; collegeAddress: string; startDate: Date; endDate: Date;
  referenceNumber: string; monthlyStipend: number; numberOfMonths: number;
  paymentType: "MONTHLY" | "ONE_TIME"; month: string; year: number;
}

export interface EmployeePayslipData {
  name: string; employeeId: string; designation: string; department: string;
  month: string; year: number; basicSalary: number; hra: number; da: number;
  otherAllowances: number; pf: number; tax: number; otherDeductions: number;
}

// ── Colors ──
const navy = rgb(0.12, 0.16, 0.32);
const blue = rgb(0.14, 0.33, 0.60);
const amber = rgb(0.60, 0.42, 0.05);
const amberBg = rgb(0.60, 0.42, 0.05);
const black = rgb(0, 0, 0);
const darkText = rgb(0.15, 0.15, 0.15);
const grayText = rgb(0.35, 0.35, 0.35);
const lightText = rgb(0.5, 0.5, 0.5);
const cellBorder = rgb(0.72, 0.72, 0.72);
const outerBorder = rgb(0.3, 0.3, 0.3);
const white = rgb(1, 1, 1);
const altRowBg = rgb(0.95, 0.96, 0.98);
const greenText = rgb(0.08, 0.45, 0.08);
const greenBg = rgb(0.91, 0.97, 0.91);
const greenBorder = rgb(0.2, 0.6, 0.2);
const redText = rgb(0.65, 0.1, 0.1);
const redBg = rgb(0.97, 0.91, 0.91);
const totalBg = rgb(0.93, 0.91, 0.84);

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

// ── Bordered cell ──
function drawCell(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string, x: number, y: number, w: number, h: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  opts: { fontSize?: number; color?: ReturnType<typeof rgb>; bg?: ReturnType<typeof rgb>; align?: "left"|"right"|"center"; paddingX?: number; borderW?: number; borderC?: ReturnType<typeof rgb> } = {},
) {
  const fs = opts.fontSize ?? 9;
  const px = opts.paddingX ?? 10;
  if (opts.bg) page.drawRectangle({ x, y, width: w, height: h, color: opts.bg });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: opts.borderC ?? cellBorder, borderWidth: opts.borderW ?? 0.5 });
  const tw = font.widthOfTextAtSize(text, fs);
  let tx = x + px;
  if (opts.align === "right") tx = x + w - tw - px;
  else if (opts.align === "center") tx = x + (w - tw) / 2;
  page.drawText(text, { x: tx, y: y + (h - fs) / 2 - 1, size: fs, font, color: opts.color ?? darkText });
}

// ── Header ──
async function drawHeader(
  page: ReturnType<PDFDocument["addPage"]>, pdfDoc: PDFDocument, fonts: Fonts,
  left: number, y: number, contentW: number,
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

// ── Signatory with seal ──
async function drawSignatory(
  page: ReturnType<PDFDocument["addPage"]>, pdfDoc: PDFDocument, fonts: Fonts,
  y: number, left: number,
): Promise<number> {
  try {
    const sealBytes = await fetch("/images/seal.png").then(r => r.arrayBuffer());
    const sealImg = await pdfDoc.embedPng(new Uint8Array(sealBytes));
    const sw = 150; const sh = sw * (607 / 411);
    page.drawImage(sealImg, { x: left + 10, y: y - sh + 60, width: sw, height: sh, opacity: 0.15 });
  } catch { /* */ }

  const fs = 10; const lh = 16;
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

function drawDisclaimer(page: ReturnType<PDFDocument["addPage"]>, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, width: number, y: number) {
  const t = "This is a computer-generated document and does not require a physical signature.";
  page.drawText(t, { x: (width - font.widthOfTextAtSize(t, 7)) / 2, y, size: 7, font, color: lightText });
}

// ═══════════════════════════════════════════════════════
// INTERN STIPEND SLIP PDF
// ═══════════════════════════════════════════════════════
export async function generateInternPayslipPdf(data: InternPayslipData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const margin = 40;
  const left = margin;
  const contentW = width - margin * 2;
  let y = height - margin;

  // Outer border
  page.drawRectangle({ x: margin - 5, y: margin - 5, width: contentW + 10, height: height - margin * 2 + 10, borderColor: outerBorder, borderWidth: 1.5 });

  // Header
  y = await drawHeader(page, pdfDoc, fonts, left, y, contentW);
  page.drawRectangle({ x: left, y, width: contentW, height: 2.5, color: amberBg });
  y -= 2.5;

  // Title band
  const titleH = 30;
  y -= titleH;
  page.drawRectangle({ x: left, y, width: contentW, height: titleH, color: amberBg });
  const title = data.paymentType === "ONE_TIME"
    ? `INTERNSHIP STIPEND SLIP — ${data.month.toUpperCase()} ${data.year}`
    : `MONTHLY STIPEND SLIP — ${data.month.toUpperCase()} ${data.year}`;
  const tw = fonts.bold.widthOfTextAtSize(title, 12);
  page.drawText(title, { x: (width - tw) / 2, y: y + 9, size: 12, font: fonts.bold, color: white });

  // Ref
  if (data.referenceNumber) {
    y -= 15;
    const ref = `Ref No: ${data.referenceNumber}`;
    const rw = fonts.regular.widthOfTextAtSize(ref, 8);
    page.drawText(ref, { x: (width - rw) / 2, y, size: 8, font: fonts.regular, color: grayText });
  } else {
    y -= 8;
  }

  // ── Employee details (4-col bordered grid) ──
  y -= 14;
  const rowH = 22;
  const halfW = contentW / 2;
  const labelW = halfW * 0.38;
  const valueW = halfW * 0.62;

  const details: [string, string, string?, string?][] = [
    ["Employee Name", data.name, "Intern ID", data.internId],
    ["Designation", data.designation, "Department", data.department],
    ["College", data.collegeName],
    ...(data.collegeAddress ? [["College Address", data.collegeAddress] as [string, string]] : []),
    ["Internship Period", `${formatDateDDMMYYYY(data.startDate)} to ${formatDateDDMMYYYY(data.endDate)}`],
  ];

  for (const row of details) {
    y -= rowH;
    drawCell(page, row[0], left, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText });
    if (row[2] && row[3]) {
      drawCell(page, row[1], left + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9 });
      drawCell(page, row[2], left + halfW, y, labelW, rowH, fonts.bold, { fontSize: 8.5, color: grayText });
      drawCell(page, row[3], left + halfW + labelW, y, valueW, rowH, fonts.regular, { fontSize: 9 });
    } else {
      drawCell(page, row[1], left + labelW, y, contentW - labelW, rowH, fonts.regular, { fontSize: 9 });
    }
  }

  // ── Stipend Details Table ──
  y -= 25;
  page.drawText("Stipend Details", { x: left, y, size: 11, font: fonts.bold, color: amber });
  y -= 4;
  page.drawRectangle({ x: left, y, width: contentW, height: 1.5, color: amber });

  const tLabelW = contentW * 0.65;
  const tValW = contentW * 0.35;
  const tRowH = 27;

  // Header
  y -= tRowH;
  drawCell(page, "Description", left, y, tLabelW, tRowH, fonts.bold, { fontSize: 9, color: white, bg: amberBg });
  drawCell(page, "Amount", left + tLabelW, y, tValW, tRowH, fonts.bold, { fontSize: 9, color: white, bg: amberBg, align: "right" });

  // Rows
  y -= tRowH;
  drawCell(page, "Monthly Stipend Rate", left, y, tLabelW, tRowH, fonts.regular, { fontSize: 9, bg: white });
  drawCell(page, formatCurrency(data.monthlyStipend), left + tLabelW, y, tValW, tRowH, fonts.regular, { fontSize: 9, bg: white, align: "right" });

  y -= tRowH;
  drawCell(page, "Number of Months", left, y, tLabelW, tRowH, fonts.regular, { fontSize: 9, bg: altRowBg });
  drawCell(page, data.numberOfMonths.toString(), left + tLabelW, y, tValW, tRowH, fonts.regular, { fontSize: 9, bg: altRowBg, align: "right" });

  y -= tRowH;
  drawCell(page, "Payment Type", left, y, tLabelW, tRowH, fonts.regular, { fontSize: 9, bg: white });
  drawCell(page, data.paymentType === "ONE_TIME" ? "One-Time Payment" : "Monthly Payment", left + tLabelW, y, tValW, tRowH, fonts.regular, { fontSize: 9, bg: white, align: "right" });

  // Total row (highlighted)
  const totalStipend = data.monthlyStipend * data.numberOfMonths;
  y -= tRowH;
  drawCell(page, `Total Stipend (${formatCurrency(data.monthlyStipend)} × ${data.numberOfMonths})`, left, y, tLabelW, tRowH, fonts.bold, { fontSize: 9.5, bg: totalBg });
  drawCell(page, formatCurrency(totalStipend), left + tLabelW, y, tValW, tRowH, fonts.bold, { fontSize: 10, bg: totalBg, align: "right" });

  // ── Net Stipend Box ──
  y -= 32;
  const netH = 36;
  page.drawRectangle({ x: left, y, width: contentW, height: netH, color: greenBg, borderColor: greenBorder, borderWidth: 1.5 });
  const netLabel = `Net Stipend Payable: ${formatCurrency(totalStipend)}`;
  const nlw = fonts.bold.widthOfTextAtSize(netLabel, 13);
  page.drawText(netLabel, { x: (width - nlw) / 2, y: y + netH / 2 - 4, size: 13, font: fonts.bold, color: greenText });

  // Amount in words
  y -= 14;
  const words = `(${numberToWords(totalStipend)})`;
  const ww = fonts.regular.widthOfTextAtSize(words, 8);
  page.drawText(words, { x: (width - ww) / 2, y, size: 8, font: fonts.regular, color: grayText });

  // ── Signatory ──
  y -= 30;
  page.drawRectangle({ x: left, y: y + 12, width: contentW, height: 1, color: cellBorder });
  y -= 5;
  const sigEnd = await drawSignatory(page, pdfDoc, fonts, y, left);
  drawDisclaimer(page, fonts.regular, width, sigEnd - 18);

  return pdfDoc.save();
}

// ═══════════════════════════════════════════════════════
// EMPLOYEE SALARY SLIP PDF
// ═══════════════════════════════════════════════════════
export async function generateEmployeePayslipPdf(data: EmployeePayslipData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadFonts(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const margin = 40;
  const left = margin;
  const contentW = width - margin * 2;
  let y = height - margin;

  // Outer border
  page.drawRectangle({ x: margin - 5, y: margin - 5, width: contentW + 10, height: height - margin * 2 + 10, borderColor: outerBorder, borderWidth: 1.5 });

  // Header
  y = await drawHeader(page, pdfDoc, fonts, left, y, contentW);
  page.drawRectangle({ x: left, y, width: contentW, height: 2.5, color: blue });
  y -= 2.5;

  // Title
  const titleH = 30;
  y -= titleH;
  page.drawRectangle({ x: left, y, width: contentW, height: titleH, color: blue });
  const title = `SALARY SLIP — ${data.month.toUpperCase()} ${data.year}`;
  const tw = fonts.bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (width - tw) / 2, y: y + 9, size: 13, font: fonts.bold, color: white });

  // Employee details
  y -= 14;
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

  // ── Earnings & Deductions (side-by-side) ──
  y -= 25;
  const gap = 10;
  const colW = (contentW - gap) / 2;
  const compW = colW * 0.6;
  const amtW = colW * 0.4;
  const tRowH = 25;

  // Section headers
  page.drawText("Earnings", { x: left, y, size: 11, font: fonts.bold, color: greenText });
  page.drawText("Deductions", { x: left + colW + gap, y, size: 11, font: fonts.bold, color: redText });
  y -= 4;
  page.drawRectangle({ x: left, y, width: contentW, height: 1.5, color: cellBorder });

  // Table headers
  y -= tRowH;
  drawCell(page, "Component", left, y, compW, tRowH, fonts.bold, { fontSize: 8.5, color: white, bg: blue });
  drawCell(page, "Amount (₹)", left + compW, y, amtW, tRowH, fonts.bold, { fontSize: 8.5, color: white, bg: blue, align: "right" });
  drawCell(page, "Component", left + colW + gap, y, compW, tRowH, fonts.bold, { fontSize: 8.5, color: white, bg: blue });
  drawCell(page, "Amount (₹)", left + colW + gap + compW, y, amtW, tRowH, fonts.bold, { fontSize: 8.5, color: white, bg: blue, align: "right" });

  // Row data
  const earnings: [string, number][] = [
    ["Basic Salary", data.basicSalary], ["HRA", data.hra], ["DA", data.da], ["Other Allowances", data.otherAllowances],
  ];
  const deductions: [string, number][] = [
    ["Provident Fund", data.pf], ["Tax", data.tax], ["Other Deductions", data.otherDeductions],
  ];
  const maxRows = Math.max(earnings.length, deductions.length);

  for (let i = 0; i < maxRows; i++) {
    y -= tRowH;
    const bg = i % 2 === 0 ? white : altRowBg;
    if (i < earnings.length) {
      drawCell(page, earnings[i][0], left, y, compW, tRowH, fonts.regular, { fontSize: 9, bg });
      drawCell(page, formatCurrency(earnings[i][1]), left + compW, y, amtW, tRowH, fonts.regular, { fontSize: 9, bg, align: "right" });
    } else {
      drawCell(page, "", left, y, compW, tRowH, fonts.regular, { bg });
      drawCell(page, "", left + compW, y, amtW, tRowH, fonts.regular, { bg });
    }
    if (i < deductions.length) {
      drawCell(page, deductions[i][0], left + colW + gap, y, compW, tRowH, fonts.regular, { fontSize: 9, bg });
      drawCell(page, formatCurrency(deductions[i][1]), left + colW + gap + compW, y, amtW, tRowH, fonts.regular, { fontSize: 9, bg, align: "right" });
    } else {
      drawCell(page, "", left + colW + gap, y, compW, tRowH, fonts.regular, { bg });
      drawCell(page, "", left + colW + gap + compW, y, amtW, tRowH, fonts.regular, { bg });
    }
  }

  // Totals row
  const gross = data.basicSalary + data.hra + data.da + data.otherAllowances;
  const totalDed = data.pf + data.tax + data.otherDeductions;
  y -= tRowH;
  drawCell(page, "Gross Earnings", left, y, compW, tRowH, fonts.bold, { fontSize: 9.5, bg: greenBg, color: greenText });
  drawCell(page, formatCurrency(gross), left + compW, y, amtW, tRowH, fonts.bold, { fontSize: 9.5, bg: greenBg, color: greenText, align: "right" });
  drawCell(page, "Total Deductions", left + colW + gap, y, compW, tRowH, fonts.bold, { fontSize: 9.5, bg: redBg, color: redText });
  drawCell(page, formatCurrency(totalDed), left + colW + gap + compW, y, amtW, tRowH, fonts.bold, { fontSize: 9.5, bg: redBg, color: redText, align: "right" });

  // ── Net Salary ──
  const net = gross - totalDed;
  y -= 30;
  const netH = 36;
  page.drawRectangle({ x: left, y, width: contentW, height: netH, color: greenBg, borderColor: greenBorder, borderWidth: 1.5 });
  const netLabel = `Net Salary Payable: ${formatCurrency(net)}`;
  const nlw = fonts.bold.widthOfTextAtSize(netLabel, 13);
  page.drawText(netLabel, { x: (width - nlw) / 2, y: y + netH / 2 - 4, size: 13, font: fonts.bold, color: greenText });

  y -= 6;
  const words = `(${numberToWords(net)})`;
  const ww = fonts.regular.widthOfTextAtSize(words, 8);
  page.drawText(words, { x: (width - ww) / 2, y, size: 8, font: fonts.regular, color: grayText });

  // ── Signatory ──
  y -= 30;
  page.drawRectangle({ x: left, y: y + 12, width: contentW, height: 1, color: cellBorder });
  y -= 5;
  const sigEnd = await drawSignatory(page, pdfDoc, fonts, y, left);
  drawDisclaimer(page, fonts.regular, width, sigEnd - 18);

  return pdfDoc.save();
}

// ═══════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════

export async function generateAndDownloadPayslip(
  intern: Intern,
  formData: { referenceNumber: string; numberOfMonths: number; paymentType: "MONTHLY"|"ONE_TIME"; month: string; year: number; collegeAddress: string; monthlyStipend?: number }
): Promise<void> {
  const data: InternPayslipData = {
    name: intern.name, internId: intern.internId,
    designation: `Intern - ${intern.domain}`, department: "IT",
    collegeName: intern.college, collegeAddress: formData.collegeAddress,
    startDate: intern.startDate, endDate: intern.endDate,
    referenceNumber: formData.referenceNumber,
    monthlyStipend: formData.monthlyStipend ?? intern.stipend ?? 0,
    numberOfMonths: formData.numberOfMonths, paymentType: formData.paymentType,
    month: formData.month, year: formData.year,
  };
  const bytes = await generateInternPayslipPdf(data);
  saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Stipend_Slip.pdf`);
}

export async function generateAndUploadPayslip(
  intern: Intern & { id: string },
  formData: { referenceNumber: string; numberOfMonths: number; paymentType: "MONTHLY"|"ONE_TIME"; month: string; year: number; collegeAddress: string; monthlyStipend?: number }
): Promise<{ payslipUrl: string; payslipKey: string }> {
  const data: InternPayslipData = {
    name: intern.name, internId: intern.internId,
    designation: `Intern - ${intern.domain}`, department: "IT",
    collegeName: intern.college, collegeAddress: formData.collegeAddress,
    startDate: intern.startDate, endDate: intern.endDate,
    referenceNumber: formData.referenceNumber,
    monthlyStipend: formData.monthlyStipend ?? intern.stipend ?? 0,
    numberOfMonths: formData.numberOfMonths, paymentType: formData.paymentType,
    month: formData.month, year: formData.year,
  };
  const bytes = await generateInternPayslipPdf(data);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const file = new File([blob], `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Stipend_Slip.pdf`, { type: "application/pdf" });
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/payslips");
  await updateInternPayslip(intern.id, fileUrl, fileKey);
  return { payslipUrl: fileUrl, payslipKey: fileKey };
}

export async function generateAndDownloadEmployeePayslip(data: EmployeePayslipData): Promise<void> {
  const bytes = await generateEmployeePayslipPdf(data);
  saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    `Payslip_${data.name.replace(/\s+/g, "_")}_${data.month}_${data.year}.pdf`);
}

export async function bulkGeneratePayslips(
  interns: Array<Intern & { id: string }>,
  formDataMap: Map<string, { referenceNumber: string; numberOfMonths: number; paymentType: "MONTHLY"|"ONE_TIME"; month: string; year: number; collegeAddress: string; monthlyStipend?: number }>,
  onProgress?: (current: number, total: number, internName: string) => void
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];
  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    const fd = formDataMap.get(intern.id);
    if (!fd) { results.push({ internId: intern.internId, success: false, error: "Missing form data" }); continue; }
    try {
      if (onProgress) onProgress(i + 1, interns.length, intern.name);
      await generateAndUploadPayslip(intern, fd);
      results.push({ internId: intern.internId, success: true });
    } catch (error) {
      results.push({ internId: intern.internId, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}
