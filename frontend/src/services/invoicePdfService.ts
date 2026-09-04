import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Invoice, Client, Project, CompanySettings } from "@/types";
import { getCompanySettings } from "./settingsService";
import { amountInWords } from "@/lib/numberToWords";

// Classic bordered GST tax-invoice layout — matches the format used by
// standard Indian accounting software (Tally/Zoho-style), per explicit
// request to match a reference invoice exactly rather than a modern/colored
// design. Everything is black-on-white with ruled borders; no brand colors.
//
// Invoices are issued either as Sparks AI Solutions (the default) or
// WelBuilt AI Solutions directly. Sparks AI Solutions is always presented as
// operating under WelBuilt AI Solutions Pvt. Ltd. — never called a "brand"
// anywhere in the document.

interface Issuer {
  name: string;
  addressLines: string[];
  logoPath: string;
  gstin: string;
  stateName: string;
  stateCode: string;
}

const ISSUERS: Record<"welbuilt" | "sparks", Issuer> = {
  sparks: {
    name: "Sparks AI Solutions",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street",
      "Tiruvannamalai, Tamil Nadu - 606601",
    ],
    logoPath: "/images/sparks/logo.png",
    gstin: "",
    stateName: "Tamil Nadu",
    stateCode: "33",
  },
  welbuilt: {
    name: "WelBuilt AI Solutions Pvt. Ltd.",
    addressLines: [
      "23/14 A, Ramalinganar 6th Street",
      "Tiruvannamalai, Tamil Nadu - 606601",
    ],
    logoPath: "/images/logo-full.png",
    gstin: "",
    stateName: "Tamil Nadu",
    stateCode: "33",
  },
};

// ── Classic monochrome palette ────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────

function formatShortDate(date: Date): string {
  // "22-Aug-25" style, matching the reference.
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const year = (date.getFullYear() % 100).toString().padStart(2, "0");
  return `${day}-${month}-${year}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

// ── Core PDF generator ───────────────────────────────────────────────────────

export async function generateInvoicePdf(
  invoice: Invoice,
  client: Client,
  _project: Project | null,
  companySettings: CompanySettings,
): Promise<Uint8Array> {
  const issuer = ISSUERS[invoice.brand ?? "sparks"];
  const sellerGstin = companySettings.gstNumber || issuer.gstin;

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

  const logoBytes = await fetchBytes(issuer.logoPath);
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

  // ── "Tax Invoice" title ───────────────────────────────────────────────
  drawCentered("Tax Invoice", PAGE_W / 2, y, 13, bold);
  y -= 20;
  const outerTop = y;

  // ── Seller block (left) + Invoice meta grid (right) ────────────────────
  const leftColW = CONTENT_W * 0.55;
  const rightColX = MARGIN + leftColW;
  const rightColW = CONTENT_W - leftColW;

  let sellerY = y - 10;
  const sellerTextX = MARGIN + 8;
  let logoW = 0;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = Math.min(28 / naturalDims.width, 28 / naturalDims.height);
    logoW = naturalDims.width * scale;
    const logoH = naturalDims.height * scale;
    page.drawImage(logoImg, { x: sellerTextX, y: sellerY - logoH + 4, width: logoW, height: logoH });
  }
  const sellerNameX = sellerTextX + (logoW ? logoW + 8 : 0);
  page.drawText(issuer.name, { x: sellerNameX, y: sellerY, size: 11, font: bold });
  sellerY -= 13;
  issuer.addressLines.forEach((line) => {
    page.drawText(line, { x: sellerTextX, y: sellerY, size: 8, font: regular, color: COLORS.slate });
    sellerY -= 11;
  });
  if (nonEmpty(sellerGstin)) {
    page.drawText(`GSTIN/UIN: ${sellerGstin}`, { x: sellerTextX, y: sellerY, size: 8, font: regular, color: COLORS.slate });
    sellerY -= 11;
  }
  page.drawText(`State Name : ${issuer.stateName}, Code : ${issuer.stateCode}`, { x: sellerTextX, y: sellerY, size: 8, font: regular, color: COLORS.slate });
  sellerY -= 11;

  // Invoice meta grid — two columns of label/value pairs, ruled like the reference.
  const metaRows: [string, string][] = [
    ["Invoice No.", invoice.invoiceNumber],
    ["Dated", formatShortDate(invoice.issueDate)],
    ["Delivery Note", ""],
    ["Mode/Terms of Payment", ""],
    ["Reference No. & Date.", ""],
    ["Other References", ""],
  ];
  const metaRowH = 15;
  let metaY = y - 2;
  const metaColSplit = rightColW * 0.55;
  metaRows.forEach(([label, value], i) => {
    page.drawText(label, { x: rightColX + 6, y: metaY - 10, size: 7.5, font: regular, color: COLORS.slate });
    if (value) {
      page.drawText(value, { x: rightColX + metaColSplit + 6, y: metaY - 10, size: 8.5, font: bold });
    }
    if (i < metaRows.length - 1) hLine(metaY - metaRowH, rightColX, rightColX + rightColW);
    metaY -= metaRowH;
  });

  const sectionBottom = Math.min(sellerY - 4, metaY);
  vLine(rightColX, outerTop, sectionBottom);
  // Label/value separator within the meta grid — spans exactly the rows drawn above.
  vLine(rightColX + metaColSplit, outerTop, metaY + metaRowH);
  hLine(sectionBottom);
  vLine(MARGIN, outerTop, sectionBottom);
  vLine(MARGIN + CONTENT_W, outerTop, sectionBottom);

  y = sectionBottom;

  // ── Consignee (Ship to) / Buyer (Bill to) — same data in both, per the
  // reference's own layout for a services company with no separate shipping
  // address. ──────────────────────────────────────────────────────────────
  const drawAddresseeBlock = (title: string, topY: number): number => {
    let by = topY - 10;
    page.drawText(title, { x: MARGIN + 8, y: by, size: 7.5, font: regular, color: COLORS.slate });
    by -= 13;
    page.drawText(client.companyName.toUpperCase(), { x: MARGIN + 8, y: by, size: 9.5, font: bold });
    by -= 12;
    if (nonEmpty(client.address)) {
      for (const line of wrapText(client.address, regular, 8.5, CONTENT_W - 16)) {
        page.drawText(line, { x: MARGIN + 8, y: by, size: 8.5, font: regular, color: COLORS.slate });
        by -= 11;
      }
    }
    if (nonEmpty(client.gstNumber)) {
      page.drawText(`GSTIN/UIN: ${client.gstNumber}`, { x: MARGIN + 8, y: by, size: 8, font: regular, color: COLORS.slate });
      by -= 11;
    }
    page.drawText(`State Name : ${issuer.stateName}, Code : ${issuer.stateCode}`, { x: MARGIN + 8, y: by, size: 8, font: regular, color: COLORS.slate });
    by -= 11;
    return by;
  };

  const consigneeBottom = drawAddresseeBlock("Consignee (Ship to)", y) - 4;
  hLine(consigneeBottom);
  vLine(MARGIN, y, consigneeBottom);
  vLine(MARGIN + CONTENT_W, y, consigneeBottom);
  y = consigneeBottom;

  const buyerBottom = drawAddresseeBlock("Buyer (Bill to)", y) - 4;
  hLine(buyerBottom);
  vLine(MARGIN, y, buyerBottom);
  vLine(MARGIN + CONTENT_W, y, buyerBottom);
  y = buyerBottom;

  // ── Line items table ───────────────────────────────────────────────────
  // Columns: Sl No. | Particulars | Quantity | Rate | per | Amount
  const colParticularsX = MARGIN + 26;
  const colQtyX = MARGIN + CONTENT_W - 175;
  const colRateRightX = MARGIN + CONTENT_W - 115;
  const colPerX = MARGIN + CONTENT_W - 95;
  const colAmountRightX = MARGIN + CONTENT_W - 8;

  const drawTableHeaderRow = (): number => {
    const headerH = 20;
    const topY = y;
    page.drawRectangle({ x: MARGIN, y: topY - headerH, width: CONTENT_W, height: headerH, color: COLORS.headerBg });
    page.drawText("Sl", { x: MARGIN + 4, y: topY - 13, size: 8, font: bold });
    page.drawText("No.", { x: MARGIN + 4, y: topY - 21, size: 6.5, font: bold });
    page.drawText("Particulars", { x: colParticularsX, y: topY - 13, size: 8, font: bold });
    page.drawText("Quantity", { x: colQtyX, y: topY - 13, size: 8, font: bold });
    drawRightAligned("Rate", colRateRightX, topY - 13, 8, bold);
    page.drawText("per", { x: colPerX, y: topY - 13, size: 8, font: bold });
    drawRightAligned("Amount", colAmountRightX, topY - 13, 8, bold);
    vLine(MARGIN + 20, topY, topY - headerH);
    vLine(colQtyX - 6, topY, topY - headerH);
    vLine(colPerX - 6, topY, topY - headerH);
    vLine(MARGIN + CONTENT_W - 60, topY, topY - headerH);
    return topY - headerH;
  };

  y = drawTableHeaderRow();
  const tableColXs = [MARGIN, MARGIN + 20, colQtyX - 6, colPerX - 6, MARGIN + CONTENT_W - 60, MARGIN + CONTENT_W];

  // The reference bills the whole compliance package as one numbered item
  // followed by unnumbered sub-lines (govt fees, then CGST/SGST as their own
  // particulars rows within the same bordered block) before the ruled total.
  // Our Invoice.lineItems is a flat list — render each as its own row, with
  // only the first row carrying the Sl No., matching that visual convention
  // when there's a single conceptual line item; multiple real line items
  // each get numbered normally.
  const rowH = 15;
  const minTableBodyH = 220; // keeps the table roughly the reference's height even with few rows

  const descMaxWidth = colQtyX - 6 - colParticularsX - 6;
  const measuredRows = invoice.lineItems.map((item) => {
    const lines = wrapText(item.description, regular, 9, descMaxWidth);
    return { item, lines, height: Math.max(rowH, lines.length * 11 + 4) };
  });
  let bodyHeight = measuredRows.reduce((sum, r) => sum + r.height, 0);

  // GST rows, drawn as additional unnumbered particulars inside the same
  // block. Gated on an actual non-zero rate, not just gstType !== "NONE" —
  // a document typed CGST_SGST with 0% rates (seen on real invoice data)
  // isn't meaningfully GST-applied, and printing "Output CGST 0%" rows plus
  // a full tax summary table of zeroes reads as a mistake, not a real
  // zero-rated supply.
  const gstRows: { label: string; rate: string; amount: number }[] = [];
  if (invoice.gstType === "CGST_SGST" && ((invoice.cgstPercent ?? 0) > 0 || (invoice.sgstPercent ?? 0) > 0)) {
    gstRows.push({ label: "Output CGST", rate: `${invoice.cgstPercent ?? 0}%`, amount: invoice.cgstAmount ?? 0 });
    gstRows.push({ label: "Output SGST", rate: `${invoice.sgstPercent ?? 0}%`, amount: invoice.sgstAmount ?? 0 });
  } else if (invoice.gstType === "IGST" && (invoice.igstPercent ?? 0) > 0) {
    gstRows.push({ label: "Output IGST", rate: `${invoice.igstPercent ?? 0}%`, amount: invoice.igstAmount ?? 0 });
  }
  bodyHeight += gstRows.length * rowH;
  if (invoice.discount > 0) bodyHeight += rowH;

  const filledBodyH = Math.max(minTableBodyH, bodyHeight + 20);

  // Rare in practice (this format's invoices are typically a handful of
  // line items), but a very long description list or many GST rows could
  // still overflow — start a fresh page rather than draw past the margin.
  const footerReserve = 140; // amount-in-words + GST summary + bank/signature + footer
  if (y - filledBodyH - 18 < footerReserve) {
    newPage();
    y = drawTableHeaderRow();
  }
  const tableTop = y;

  let rowY = tableTop;
  measuredRows.forEach(({ item, lines }, idx) => {
    const thisRowH = Math.max(rowH, lines.length * 11 + 4);
    if (idx === 0) {
      page.drawText("1", { x: MARGIN + 6, y: rowY - 12, size: 9, font: regular });
    }
    lines.forEach((line, li) => {
      page.drawText(line, { x: colParticularsX, y: rowY - 12 - li * 11, size: 9, font: li === 0 ? bold : regular });
    });
    if (item.quantity > 1 || item.rate > 0) {
      page.drawText(String(item.quantity), { x: colQtyX, y: rowY - 12, size: 9, font: regular });
      drawRightAligned(formatMoney(item.rate), colRateRightX, rowY - 12, 9, regular);
    }
    drawRightAligned(formatMoney(item.amount), colAmountRightX, rowY - 12, 9, regular);
    rowY -= thisRowH;
  });

  for (const g of gstRows) {
    page.drawText(g.label, { x: colParticularsX, y: rowY - 12, size: 9, font: regular });
    page.drawText(g.rate, { x: colRateRightX + 4, y: rowY - 12, size: 9, font: regular });
    drawRightAligned(formatMoney(g.amount), colAmountRightX, rowY - 12, 9, regular);
    rowY -= rowH;
  }

  if (invoice.discount > 0) {
    page.drawText("Discount", { x: colParticularsX, y: rowY - 12, size: 9, font: regular });
    drawRightAligned(`(-) ${formatMoney(invoice.discount)}`, colAmountRightX, rowY - 12, 9, regular);
    rowY -= rowH;
  }

  const tableBottom = tableTop - filledBodyH;

  // Column rules for the full body height, then the Total row. PDF's y-axis
  // increases upward, so a row spanning [rowBottomY, rowTopY] must keep its
  // text baseline BELOW rowTopY by less than the row's own height, i.e.
  // baseline = rowTopY - offset with offset < rowHeight. Getting this
  // backwards (text placed at a coordinate outside the row it's meant to be
  // in) is exactly what produced the Total/Amount-Chargeable overlap here
  // originally — confirmed by direct baseline-coordinate logging, not just
  // eyeballing the render.
  const totalRowTopY = tableBottom;
  const totalRowH = 22;
  const totalRowBottomY = totalRowTopY - totalRowH;
  for (let i = 1; i < tableColXs.length - 1; i++) {
    vLine(tableColXs[i], tableTop, totalRowBottomY);
  }
  vLine(MARGIN, tableTop, totalRowBottomY);
  vLine(MARGIN + CONTENT_W, tableTop, totalRowBottomY);
  hLine(totalRowBottomY, MARGIN, MARGIN + CONTENT_W);

  page.drawText("Total", { x: colQtyX - 40, y: totalRowTopY - 14, size: 9.5, font: bold });
  drawRightAligned(formatMoney(invoice.total), colAmountRightX, totalRowTopY - 14, 10, bold);
  hLine(totalRowTopY);

  y = totalRowBottomY;

  // ── Amount Chargeable (in words) ───────────────────────────────────────
  const wordsRowTopY = y;
  const wordsRowH = 30;
  const wordsRowBottomY = wordsRowTopY - wordsRowH;
  page.drawText("Amount Chargeable (in words)", { x: MARGIN + 8, y: wordsRowTopY - 12, size: 8, font: regular, color: COLORS.slate });
  drawRightAligned("E. & O.E", MARGIN + CONTENT_W - 8, wordsRowTopY - 12, 7.5, regular, COLORS.slate);
  page.drawText(amountInWords(invoice.total), { x: MARGIN + 8, y: wordsRowTopY - 24, size: 9.5, font: bold });
  vLine(MARGIN, wordsRowTopY, wordsRowBottomY);
  vLine(MARGIN + CONTENT_W, wordsRowTopY, wordsRowBottomY);
  y = wordsRowBottomY;
  hLine(y);
  hLine(y);

  // ── HSN/SAC-style GST summary table (simplified: one Taxable Value row) ──
  // Same non-zero-rate gate as the line-item GST rows above.
  const hasGst = gstRows.length > 0;
  if (hasGst) {
    const summaryHeaderH = 24;
    const sTop = y;
    const colTaxable = MARGIN + CONTENT_W * 0.35;
    const colCgstRate = MARGIN + CONTENT_W * 0.5;
    const colCgstAmt = MARGIN + CONTENT_W * 0.6;
    const colSgstRate = MARGIN + CONTENT_W * 0.7;
    const colSgstAmt = MARGIN + CONTENT_W * 0.8;
    const colTotalTax = MARGIN + CONTENT_W;

    page.drawText("Taxable", { x: MARGIN + 8, y: sTop - 10, size: 7.5, font: bold });
    page.drawText("Value", { x: MARGIN + 8, y: sTop - 19, size: 7.5, font: bold });
    drawCentered(invoice.gstType === "IGST" ? "IGST" : "CGST", (colCgstRate + colCgstAmt) / 2, sTop - 10, 7.5, bold);
    if (invoice.gstType === "CGST_SGST") {
      drawCentered("SGST/UTGST", (colSgstRate + colSgstAmt) / 2, sTop - 10, 7.5, bold);
    }
    drawCentered("Total", (colSgstAmt + colTotalTax) / 2, sTop - 10, 7.5, bold);
    drawCentered("Tax Amount", (colSgstAmt + colTotalTax) / 2, sTop - 19, 7.5, bold);

    y -= summaryHeaderH;
    hLine(y, MARGIN, MARGIN + CONTENT_W);

    const dataRowH = 15;
    const taxAmount = (invoice.cgstAmount ?? 0) + (invoice.sgstAmount ?? 0) + (invoice.igstAmount ?? 0);
    drawRightAligned(formatMoney(invoice.subtotal), colTaxable, y - 11, 8.5, regular);
    if (invoice.gstType === "CGST_SGST") {
      drawCentered(`${invoice.cgstPercent ?? 0}%`, colCgstRate, y - 11, 8.5, regular);
      drawRightAligned(formatMoney(invoice.cgstAmount ?? 0), colCgstAmt, y - 11, 8.5, regular);
      drawCentered(`${invoice.sgstPercent ?? 0}%`, colSgstRate, y - 11, 8.5, regular);
      drawRightAligned(formatMoney(invoice.sgstAmount ?? 0), colSgstAmt, y - 11, 8.5, regular);
    } else {
      drawCentered(`${invoice.igstPercent ?? 0}%`, colCgstRate, y - 11, 8.5, regular);
      drawRightAligned(formatMoney(invoice.igstAmount ?? 0), colCgstAmt, y - 11, 8.5, regular);
    }
    drawRightAligned(formatMoney(taxAmount), colTotalTax - 8, y - 11, 8.5, regular);
    y -= dataRowH;
    hLine(y, MARGIN, MARGIN + CONTENT_W);

    page.drawText("Total", { x: MARGIN + 8, y: y - 11, size: 8.5, font: bold });
    drawRightAligned(formatMoney(invoice.subtotal), colTaxable, y - 11, 8.5, bold);
    if (invoice.gstType === "CGST_SGST") {
      drawRightAligned(formatMoney(invoice.cgstAmount ?? 0), colCgstAmt, y - 11, 8.5, bold);
      drawRightAligned(formatMoney(invoice.sgstAmount ?? 0), colSgstAmt, y - 11, 8.5, bold);
    } else {
      drawRightAligned(formatMoney(invoice.igstAmount ?? 0), colCgstAmt, y - 11, 8.5, bold);
    }
    drawRightAligned(formatMoney(taxAmount), colTotalTax - 8, y - 11, 8.5, bold);
    y -= dataRowH;

    vLine(MARGIN, sTop, y);
    vLine(colTaxable + 4, sTop, y);
    vLine(colCgstAmt + 4, sTop, y);
    if (invoice.gstType === "CGST_SGST") vLine(colSgstAmt + 4, sTop, y);
    vLine(MARGIN + CONTENT_W, sTop, y);
    hLine(y, MARGIN, MARGIN + CONTENT_W);

    // Tax amount in words
    const taxWordsH = 20;
    page.drawText("Tax Amount (in words) :", { x: MARGIN + 8, y: y - 13, size: 8, font: regular, color: COLORS.slate });
    const label = "Tax Amount (in words) : ";
    const labelW = regular.widthOfTextAtSize(label, 8);
    page.drawText(amountInWords(taxAmount), { x: MARGIN + 8 + labelW + 4, y: y - 13, size: 8.5, font: bold });
    vLine(MARGIN, y, y - taxWordsH);
    vLine(MARGIN + CONTENT_W, y, y - taxWordsH);
    y -= taxWordsH;
    hLine(y, MARGIN, MARGIN + CONTENT_W);
  }

  // ── Bank details + signature block ─────────────────────────────────────
  const bd = companySettings.bankDetails;
  const hasBankDetails = bd && (nonEmpty(bd.accountHolderName) || nonEmpty(bd.bankName) || nonEmpty(bd.accountNumber) || nonEmpty(bd.ifscCode));

  // The signature block (2 lines, ~34pt) always needs room regardless of
  // whether bank details render — this is what previously overlapped when
  // there were no bank details to pad the block out.
  const minSignatureBlockH = 50;
  const bankContentH = hasBankDetails ? 24 + 44 : 0; // heading + up to 4 lines @ 11pt
  const bankBlockH = Math.max(minSignatureBlockH, bankContentH);
  const bankTop = y;
  if (hasBankDetails && bd) {
    page.drawText("Company's Bank Details", { x: MARGIN + 8, y: bankTop - 12, size: 8.5, font: bold });
    let by = bankTop - 24;
    const bankLines = [
      nonEmpty(bd.accountHolderName) && `A/c Holder's Name: ${bd.accountHolderName}`,
      nonEmpty(bd.bankName) && `Bank Name : ${bd.bankName}`,
      nonEmpty(bd.accountNumber) && `A/c No. : ${bd.accountNumber}`,
      nonEmpty(bd.ifscCode) && `Branch & IFS Code : ${bd.ifscCode}`,
    ].filter((line): line is string => Boolean(line));
    for (const line of bankLines) {
      page.drawText(line, { x: MARGIN + 8, y: by, size: 8, font: regular, color: COLORS.slate });
      by -= 11;
    }
  }

  const sigLabel = `for ${issuer.name}`;
  drawRightAligned(sigLabel, MARGIN + CONTENT_W - 8, bankTop - 14, 8.5, bold);
  drawRightAligned("Authorised Signatory", MARGIN + CONTENT_W - 8, bankTop - bankBlockH + 10, 8, regular, COLORS.slate);

  y -= bankBlockH;
  vLine(MARGIN, bankTop, y);
  vLine(MARGIN + CONTENT_W, bankTop, y);
  hLine(y, MARGIN, MARGIN + CONTENT_W);

  // ── Footer ──────────────────────────────────────────────────────────────
  drawCentered("This is a Computer Generated Invoice", PAGE_W / 2, y - 16, 7.5, regular, COLORS.slate);

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────────

export async function generateAndDownloadInvoicePdf(
  invoice: Invoice,
  client: Client,
  project: Project | null,
): Promise<void> {
  const companySettings = await getCompanySettings();
  const pdfBytes = await generateInvoicePdf(invoice, client, project, companySettings);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, `${invoice.invoiceNumber}_${client.companyName.replace(/\s+/g, "_")}.pdf`);
}
