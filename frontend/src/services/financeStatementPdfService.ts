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
  // Logo only, no company-name text beside or under it — the logo already
  // carries the brand mark (same convention invoicePdfService.ts already
  // uses), so a redundant "WelBuilt AI Solutions Pvt. Ltd." text line was
  // dropped per explicit request. Address sits directly below the logo,
  // stacked, not beside it.
  const LOGO_H = 34;
  const headerTextX = MARGIN;
  const logoTopY = y - 6;
  let headerY = logoTopY - LOGO_H - 4;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = LOGO_H / naturalDims.height;
    const logoW = naturalDims.width * scale;
    page.drawImage(logoImg, { x: headerTextX, y: logoTopY - LOGO_H, width: logoW, height: LOGO_H });
  }
  ISSUER.addressLines.forEach((line) => {
    page.drawText(line, { x: headerTextX, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  });
  if (gstin) {
    page.drawText(`GSTIN/UIN: ${gstin}`, { x: headerTextX, y: headerY, size: 8, font: regular, color: COLORS.slate });
    headerY -= 11;
  }

  // Title + meta sit on their own row below the whole company block (logo
  // + address), not beside it.
  const metaTop = headerY - 10;
  drawCentered(options.title, PAGE_W / 2, metaTop, 14, bold);
  drawRightAligned(`Period: ${options.dateRangeLabel || "All time"}`, MARGIN + CONTENT_W, metaTop, 8.5, regular, COLORS.slate);
  drawRightAligned(`Generated: ${formatShortDate(new Date())}`, MARGIN + CONTENT_W, metaTop - 12, 8.5, regular, COLORS.slate);

  y = metaTop - 24;
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
  // A row's text baseline sits at rowTop - TEXT_BASELINE_OFFSET (first
  // line) and the row needs ROW_BOTTOM_PAD clearance below its LAST
  // baseline before the divider that closes it off — otherwise text and
  // the line below it visually collide, which is exactly what a too-thin
  // bottom margin here produced (only ~3pt of clearance), especially
  // visible once a Description wrapped to two lines.
  const TEXT_BASELINE_OFFSET = 11;
  const LINE_STEP = 12;
  const ROW_BOTTOM_PAD = 6;
  const rowH = TEXT_BASELINE_OFFSET + ROW_BOTTOM_PAD; // single-line row height

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
  // What the Net summary box needs on whatever page it lands on — reserved
  // ahead of time by the final section's own pagination (see
  // `reserveForFollowingBlock` below), not just checked after both
  // sections finish drawing. That late, separate check was the actual bug:
  // each row only reserved its own ~25pt trailing buffer, so the last
  // section's subtotal could land a few points above minUsableY, pass its
  // own check, and then have the 70pt summary box slapped on right after —
  // overlapping whatever was already near the bottom of that page.
  const netSummaryH = 70;

  // Groups rows by calendar month (newest first, matching the newest-first
  // sort already applied upstream) so the statement reads as a real
  // month-wise P&L rather than one long flat ledger — the filing-ready
  // shape an accountant expects, with a subtotal per month instead of only
  // one grand total at the very end.
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  function groupByMonth(rows: StatementRow[]): { key: string; label: string; rows: StatementRow[] }[] {
    const groups = new Map<string, StatementRow[]>();
    for (const row of rows) {
      const key = monthKey(row.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1)) // newest month first
      .map(([key, groupRows]) => ({ key, label: monthLabel(groupRows[0].date), rows: groupRows }));
  }

  // Draws one section (Income or Expenses): a month subheader + ruled table
  // + month-subtotal for each calendar month present, then a bold Total row
  // for the whole section. `reserveForFollowingBlock` is the extra trailing
  // space (beyond this section's own rows) that must still fit on the same
  // page as this section's very last row — used to pull the Net summary
  // box's page-break decision into the same pagination pass instead of
  // being checked separately afterward.
  const drawSection = (sectionLabel: string, rows: StatementRow[], reserveForFollowingBlock: number): number => {
    if (y < minUsableY + 60) newPage();

    drawCentered(sectionLabel, PAGE_W / 2, y - 2, 11, bold);
    y -= 18;

    const monthGroups = groupByMonth(rows);
    let sectionTotal = 0;

    if (monthGroups.length === 0) {
      y = drawTableHeaderRow();
      page.drawText("No records in this period", { x: MARGIN + 6, y: y - TEXT_BASELINE_OFFSET, size: 9, font: regular, color: COLORS.slate });
      closeTableSection(y, y - rowH);
      y -= rowH;
    }

    monthGroups.forEach((group, groupIdx) => {
      const isLastGroup = groupIdx === monthGroups.length - 1;
      if (y < minUsableY + 50) newPage();

      page.drawText(group.label, { x: MARGIN + 2, y: y - 2, size: 9, font: bold, color: COLORS.slate });
      y -= 14;

      y = drawTableHeaderRow();

      const measuredRows = group.rows.map((row) => {
        const lines = wrapText(row.description, regular, 9, descMaxWidth);
        const height = TEXT_BASELINE_OFFSET + (lines.length - 1) * LINE_STEP + ROW_BOTTOM_PAD;
        return { row, lines, height: Math.max(rowH, height) };
      });

      let tableTop = y;
      let rowY = tableTop;
      let rowsDrawnOnThisPage = 0;
      let monthSubtotal = 0;

      for (let i = 0; i < measuredRows.length; i++) {
        const { row, lines, height } = measuredRows[i];
        const isLastRowOfSection = isLastGroup && i === measuredRows.length - 1;
        // Only the section's final row needs to additionally fit the
        // caller-supplied trailing block (e.g. the Net summary); every
        // other row — including the last row of a non-final month, and the
        // last row of a non-final section — only needs its own small
        // subtotal-row buffer.
        const trailingReserve = isLastRowOfSection ? rowH + 10 + reserveForFollowingBlock : rowH + 10;
        if (rowY - height - trailingReserve < minUsableY && rowsDrawnOnThisPage > 0) {
          closeTableSection(tableTop, rowY);
          drawCentered("(Continued on next page)", PAGE_W / 2, rowY - TEXT_BASELINE_OFFSET, 7.5, regular, COLORS.slate);
          newPage();
          y = drawTableHeaderRow();
          tableTop = y;
          rowY = tableTop;
          rowsDrawnOnThisPage = 0;
        }

        page.drawText(formatShortDate(row.date), { x: MARGIN + 6, y: rowY - TEXT_BASELINE_OFFSET, size: 8.5, font: regular });
        lines.forEach((line, li) => {
          page.drawText(line, { x: colDescX, y: rowY - TEXT_BASELINE_OFFSET - li * LINE_STEP, size: 9, font: regular });
        });
        const categorySize = fitFontSize(row.categoryLabel, regular, 8.5, categoryMaxWidth);
        page.drawText(row.categoryLabel, { x: colCategoryX, y: rowY - TEXT_BASELINE_OFFSET, size: categorySize, font: regular, color: COLORS.slate });
        drawRightAligned(formatMoney(row.amount), colAmountRightX, rowY - TEXT_BASELINE_OFFSET, 9, regular);

        monthSubtotal += row.amount;
        rowY -= height;
        rowsDrawnOnThisPage++;
      }

      const subtotalRowH = TEXT_BASELINE_OFFSET + ROW_BOTTOM_PAD + 4;
      const subtotalTopY = rowY;
      const subtotalBottomY = subtotalTopY - subtotalRowH;
      closeTableSection(tableTop, subtotalBottomY);
      // Label starts at the row's full left edge (not colCategoryX) — that
      // narrow Category-column span was sized for short category words,
      // not a "<Month> Subtotal" label, which ran into the right-aligned
      // amount for any month name longer than ~4 characters.
      page.drawText(`${group.label} Subtotal`, { x: MARGIN + 8, y: subtotalTopY - TEXT_BASELINE_OFFSET, size: 8.5, font: bold, color: COLORS.slate });
      drawRightAligned(formatMoney(monthSubtotal), colAmountRightX, subtotalTopY - TEXT_BASELINE_OFFSET, 9, bold);
      hLine(subtotalTopY);

      sectionTotal += monthSubtotal;
      y = subtotalBottomY - 10;
    });

    // Section grand total — bold, visually heavier than a month subtotal,
    // always immediately after the last month's subtotal (never paginated
    // away from it: it was already reserved for via reserveForFollowingBlock
    // on the last row above when this is the final section).
    const totalRowH = TEXT_BASELINE_OFFSET + ROW_BOTTOM_PAD + 4;
    const totalTopY = y;
    const totalBottomY = totalTopY - totalRowH;
    closeTableSection(totalTopY, totalBottomY);
    page.drawText(`Total ${sectionLabel}`, { x: MARGIN + 8, y: totalTopY - TEXT_BASELINE_OFFSET, size: 10, font: bold });
    drawRightAligned(formatMoney(sectionTotal), colAmountRightX, totalTopY - TEXT_BASELINE_OFFSET, 11, bold);
    hLine(totalTopY);

    y = totalBottomY - 20;
    return sectionTotal;
  };

  // The Net summary's 70pt is only relevant to whichever section draws
  // last — reserve it there so that section's own pagination keeps the
  // summary glued to its total instead of a page break landing between them.
  const hasNetSummary = !!(options.income && options.expenses);
  const incomeTotal = options.income
    ? drawSection("Income", options.income, !options.expenses && hasNetSummary ? netSummaryH : 0)
    : 0;
  const expenseTotal = options.expenses
    ? drawSection("Expenses", options.expenses, hasNetSummary ? netSummaryH : 0)
    : 0;

  // ── Net summary ─────────────────────────────────────────────────────
  if (options.income && options.expenses) {
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
