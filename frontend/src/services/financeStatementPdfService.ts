import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Income, Expense } from "@/types";
import { getCompanySettings } from "./settingsService";

// Filing-ready Income & Expense statement — same classic bordered,
// black-on-white layout family as invoicePdfService.ts (same page size,
// margins, font-embedding, and draw-helper conventions) so it reads as
// belonging to the same document set, not a mismatched one-off. Unlike an
// invoice this is a ledger-style report: two ruled tables (Income,
// Expenses) each with a subtotal row, followed by a Net summary — the
// shape a high-level company would expect for internal filing, not a
// GST tax document.

interface StatementIssuer {
  name: string;
  addressLines: string[];
  logoPath: string;
}

const ISSUER: StatementIssuer = {
  name: "WelBuilt AI Solutions Pvt. Ltd.",
  addressLines: [
    "23/14 A, Ramalinganar 6th Street",
    "Tiruvannamalai, Tamil Nadu - 606601",
  ],
  logoPath: "/images/logo-full.png",
};

const COLORS = {
  ink: rgb(0.05, 0.05, 0.05),
  slate: rgb(0.3, 0.3, 0.3),
  line: rgb(0, 0, 0),
  headerBg: rgb(0.93, 0.93, 0.93),
  positive: rgb(0.1, 0.45, 0.2),
  negative: rgb(0.6, 0.15, 0.15),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Helpers ───────────────────────────────────────────────────────────────

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

// Shrinks font size (down to a floor) so `text` fits within `maxWidth` at
// one line — used for the Category column, where truncating a label would
// lose information a filing document shouldn't lose.
function fitFontSize(text: string, font: import("pdf-lib").PDFFont, startSize: number, maxWidth: number, minSize: number = 6.5): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
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

export interface StatementRow {
  date: Date;
  description: string;
  categoryLabel: string;
  amount: number;
}

export interface StatementOptions {
  title: string; // "Income & Expense Statement" | "Income Statement" | "Expense Statement"
  dateRangeLabel?: string; // e.g. "01 Oct 2026 – 22 Oct 2026", omitted = "All time"
  income?: StatementRow[];
  expenses?: StatementRow[];
}

// ── Core PDF generator ───────────────────────────────────────────────────

export async function generateFinanceStatementPdf(options: StatementOptions): Promise<Uint8Array> {
  const companySettings = await getCompanySettings();
  const gstin = companySettings.gstNumber;

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

  const logoBytes = await fetchBytes(ISSUER.logoPath);
  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

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

  // ── Header: company block + title + meta ─────────────────────────────
  const LOGO_H = 30;
  const headerTextX = MARGIN;
  let headerY = y - 10;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = LOGO_H / naturalDims.height;
    const logoW = naturalDims.width * scale;
    page.drawImage(logoImg, { x: headerTextX, y: headerY - LOGO_H + 8, width: logoW, height: LOGO_H });
  }
  headerY -= LOGO_H - 2;
  page.drawText(ISSUER.name, { x: headerTextX, y: headerY, size: 11, font: bold });
  headerY -= 13;
  ISSUER.addressLines.forEach((line) => {
    page.drawText(line, { x: headerTextX, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  });
  if (gstin) {
    page.drawText(`GSTIN/UIN: ${gstin}`, { x: headerTextX, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  }

  drawCentered(options.title, PAGE_W / 2, y - 10, 14, bold);
  drawRightAligned(`Period: ${options.dateRangeLabel || "All time"}`, MARGIN + CONTENT_W, y - 28, 8.5, regular, COLORS.slate);
  drawRightAligned(`Generated: ${formatShortDate(new Date())}`, MARGIN + CONTENT_W, y - 40, 8.5, regular, COLORS.slate);

  y = Math.min(headerY, y - 52) - 10;
  hLine(y);
  y -= 16;

  // ── Column layout shared by both tables ───────────────────────────────
  // Four columns (Date | Description | Category | Amount) need three
  // interior dividers. Category and Amount previously shared one
  // undivided 150pt space with Category left-aligned and Amount
  // right-aligned into it — fine for a short label, but a long category
  // name (e.g. "Hosting & Infrastructure") ran straight into the
  // right-aligned amount with no gap. Giving Category its own bounded
  // column with a real divider before Amount fixes that structurally.
  const colDateDivX = MARGIN + 60;
  const colCategoryDivX = MARGIN + CONTENT_W - 150;
  const colAmountDivX = MARGIN + CONTENT_W - 65;

  const colDescX = colDateDivX + 6;
  const colCategoryX = colCategoryDivX + 6;
  const colAmountRightX = MARGIN + CONTENT_W - 8;
  const descMaxWidth = colCategoryDivX - 6 - colDescX - 6;
  const categoryMaxWidth = colAmountDivX - 6 - colCategoryX - 4;

  const tableColXs = [MARGIN, colDateDivX, colCategoryDivX, colAmountDivX, MARGIN + CONTENT_W];
  const rowH = 15;

  const drawTableHeaderRow = (): number => {
    const headerH = 20;
    const topY = y;
    page.drawRectangle({ x: MARGIN, y: topY - headerH, width: CONTENT_W, height: headerH, color: COLORS.headerBg });
    hLine(topY, MARGIN, MARGIN + CONTENT_W);
    page.drawText("Date", { x: MARGIN + 6, y: topY - 14, size: 8, font: bold });
    page.drawText("Description", { x: colDescX, y: topY - 14, size: 8, font: bold });
    page.drawText("Category", { x: colCategoryX, y: topY - 14, size: 8, font: bold });
    drawRightAligned("Amount", colAmountRightX, topY - 14, 8, bold);
    vLine(colDateDivX, topY, topY - headerH);
    vLine(colCategoryDivX, topY, topY - headerH);
    vLine(colAmountDivX, topY, topY - headerH);
    vLine(MARGIN, topY, topY - headerH);
    vLine(MARGIN + CONTENT_W, topY, topY - headerH);
    return topY - headerH;
  };

  const closeTableSection = (sectionTopY: number, sectionBottomY: number) => {
    for (let i = 1; i < tableColXs.length - 1; i++) {
      vLine(tableColXs[i], sectionTopY, sectionBottomY);
    }
    vLine(MARGIN, sectionTopY, sectionBottomY);
    vLine(MARGIN + CONTENT_W, sectionTopY, sectionBottomY);
    hLine(sectionBottomY, MARGIN, MARGIN + CONTENT_W);
  };

  const minUsableY = MARGIN + 40;

  // Draws one section (Income or Expenses): header row, every row with
  // row-by-row pagination (repeating the header on a new page when a row
  // doesn't fit), then a subtotal row. Returns the subtotal.
  const drawSection = (sectionLabel: string, rows: StatementRow[]): number => {
    if (y < minUsableY + 60) newPage();

    drawCentered(sectionLabel, PAGE_W / 2, y - 2, 11, bold);
    y -= 18;

    y = drawTableHeaderRow();

    const measuredRows = rows.map((row) => {
      const lines = wrapText(row.description, regular, 9, descMaxWidth);
      return { row, lines, height: Math.max(rowH, lines.length * 11 + 4) };
    });

    let tableTop = y;
    let rowY = tableTop;
    let rowsDrawnOnThisPage = 0;
    let subtotal = 0;

    for (let i = 0; i < measuredRows.length; i++) {
      const { row, lines, height } = measuredRows[i];
      const isLastRow = i === measuredRows.length - 1;
      const trailingReserve = isLastRow ? rowH + 10 : rowH;
      if (rowY - height - trailingReserve < minUsableY && rowsDrawnOnThisPage > 0) {
        closeTableSection(tableTop, rowY);
        drawCentered("(Continued on next page)", PAGE_W / 2, rowY - 12, 7.5, regular, COLORS.slate);
        newPage();
        y = drawTableHeaderRow();
        tableTop = y;
        rowY = tableTop;
        rowsDrawnOnThisPage = 0;
      }

      page.drawText(formatShortDate(row.date), { x: MARGIN + 6, y: rowY - 12, size: 8.5, font: regular });
      lines.forEach((line, li) => {
        page.drawText(line, { x: colDescX, y: rowY - 12 - li * 11, size: 9, font: regular });
      });
      const categorySize = fitFontSize(row.categoryLabel, regular, 8.5, categoryMaxWidth);
      page.drawText(row.categoryLabel, { x: colCategoryX, y: rowY - 12, size: categorySize, font: regular, color: COLORS.slate });
      drawRightAligned(formatMoney(row.amount), colAmountRightX, rowY - 12, 9, regular);

      subtotal += row.amount;
      rowY -= height;
      rowsDrawnOnThisPage++;
    }

    if (measuredRows.length === 0) {
      page.drawText("No records in this period", { x: MARGIN + 6, y: rowY - 12, size: 9, font: regular, color: COLORS.slate });
      rowY -= rowH;
    }

    const subtotalTopY = rowY;
    const subtotalBottomY = subtotalTopY - rowH - 6;
    closeTableSection(tableTop, subtotalBottomY);
    page.drawText(`Total ${sectionLabel}`, { x: colCategoryX, y: subtotalTopY - 13, size: 9.5, font: bold });
    drawRightAligned(formatMoney(subtotal), colAmountRightX, subtotalTopY - 13, 10, bold);
    hLine(subtotalTopY);

    y = subtotalBottomY - 20;
    return subtotal;
  };

  const incomeTotal = options.income ? drawSection("Income", options.income) : 0;
  const expenseTotal = options.expenses ? drawSection("Expenses", options.expenses) : 0;

  // ── Net summary ─────────────────────────────────────────────────────
  if (options.income && options.expenses) {
    if (y < minUsableY + 70) newPage();
    const net = incomeTotal - expenseTotal;
    const summaryTop = y;
    const summaryH = 70;
    const summaryBottom = summaryTop - summaryH;
    vLine(MARGIN, summaryTop, summaryBottom);
    vLine(MARGIN + CONTENT_W, summaryTop, summaryBottom);
    hLine(summaryTop);
    hLine(summaryBottom);

    let sy = summaryTop - 18;
    page.drawText("Total Income", { x: MARGIN + 10, y: sy, size: 9.5, font: regular });
    drawRightAligned(formatMoney(incomeTotal), colAmountRightX, sy, 9.5, regular);
    sy -= 16;
    page.drawText("Total Expenses", { x: MARGIN + 10, y: sy, size: 9.5, font: regular });
    drawRightAligned(formatMoney(expenseTotal), colAmountRightX, sy, 9.5, regular);
    sy -= 18;
    hLine(sy + 8, MARGIN + 10, MARGIN + CONTENT_W - 10);
    page.drawText("Net", { x: MARGIN + 10, y: sy - 6, size: 11, font: bold });
    drawRightAligned(formatMoney(net), colAmountRightX, sy - 6, 12, bold, net >= 0 ? COLORS.positive : COLORS.negative);

    y = summaryBottom;
  }

  // ── Footer ──────────────────────────────────────────────────────────
  drawCentered("This is a computer-generated statement.", PAGE_W / 2, Math.min(y, MARGIN + 20) - 16, 7.5, regular, COLORS.slate);

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────

function toStatementRows<T extends { date: Date; description: string; amount: number }>(
  records: T[],
  categoryLabel: (record: T) => string
): StatementRow[] {
  return [...records]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((record) => ({
      date: record.date,
      description: record.description,
      amount: record.amount,
      categoryLabel: categoryLabel(record),
    }));
}

export function incomeToStatementRows(incomes: Income[], categoryLabel: (c: Income["category"]) => string): StatementRow[] {
  return toStatementRows(incomes, (i) => categoryLabel(i.category));
}

export function expensesToStatementRows(expenses: Expense[], categoryLabel: (c: Expense["category"]) => string): StatementRow[] {
  return toStatementRows(expenses, (e) => categoryLabel(e.category));
}

export async function generateFinanceStatementPdfBlob(options: StatementOptions): Promise<Blob> {
  const pdfBytes = await generateFinanceStatementPdf(options);
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export async function generateAndDownloadFinanceStatementPdf(options: StatementOptions, fileName: string): Promise<void> {
  const blob = await generateFinanceStatementPdfBlob(options);
  saveAs(blob, fileName);
}
