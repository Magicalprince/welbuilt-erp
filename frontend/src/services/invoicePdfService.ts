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
  // No dedicated WelBuilt signature asset exists yet — undefined degrades
  // to just the seal, which is still a real improvement over no signature
  // image at all (the previous state for both issuers).
  signaturePath?: string;
  sealPath?: string;
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
    signaturePath: "/images/sparks/signature.png",
    sealPath: "/images/sparks/seal.png",
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
    sealPath: "/images/seal.png",
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

  const [logoBytes, signatureBytes, sealBytes] = await Promise.all([
    fetchBytes(issuer.logoPath),
    issuer.signaturePath ? fetchBytes(issuer.signaturePath) : Promise.resolve(null),
    issuer.sealPath ? fetchBytes(issuer.sealPath) : Promise.resolve(null),
  ]);
  const logoImg = logoBytes ? await pdfDoc.embedPng(logoBytes).catch(() => null) : null;
  const signatureImg = signatureBytes ? await pdfDoc.embedPng(signatureBytes).catch(() => null) : null;
  const sealImg = sealBytes ? await pdfDoc.embedPng(sealBytes).catch(() => null) : null;

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

  // ── Title ────────────────────────────────────────────────────────────
  // "Invoice", not "Tax Invoice" — GST is one optional line among several
  // billing shapes this document covers, not always present, so a title
  // that names it specifically would be wrong on a no-GST bill.
  drawCentered("Invoice", PAGE_W / 2, y, 13, bold);
  y -= 20;
  const outerTop = y;

  // ── Seller block (left) + Invoice meta grid (right) ────────────────────
  const leftColW = CONTENT_W * 0.55;
  const rightColX = MARGIN + leftColW;
  const rightColW = CONTENT_W - leftColW;

  let sellerY = y - 10;
  const sellerTextX = MARGIN + 8;

  // The logo image already carries the company name/mark visually, so
  // drawing issuer.name as text right beside it just duplicated it — user
  // asked for the name text removed, leaving the logo alone to identify the
  // seller. Freed from needing to sit beside a text line, the logo can be
  // sized larger without touching the address lines below it (previous
  // overlap bug came from over-sizing while a name line still shared its row).
  const LOGO_H = 30;
  if (logoImg) {
    const naturalDims = logoImg.scale(1);
    const scale = LOGO_H / naturalDims.height;
    const logoW = naturalDims.width * scale;
    page.drawImage(logoImg, { x: sellerTextX, y: sellerY - LOGO_H + 8, width: logoW, height: LOGO_H });
  }
  sellerY -= LOGO_H - 2;
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
  // Top edge of the very first bordered block — every other block's top
  // line is implicitly the previous block's bottom line, but this one has
  // no predecessor, so it needs its own explicit rule or the whole invoice
  // starts with an unclosed table (the "top line is missing" complaint).
  hLine(outerTop);
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

  // Visual gap between the header/addressee block and the line-items table
  // — they read as one continuous grid without this, which was the
  // "clumsy" complaint. No border here; the two blocks are deliberately
  // separate tables now.
  const BLOCK_GAP = 10;
  y -= BLOCK_GAP;

  // ── Line items table ───────────────────────────────────────────────────
  // Columns: Sl No. | Particulars | Quantity | Rate | Amount — five columns
  // need four interior dividers. A "per" (unit) column used to sit between
  // Rate and Amount, but nothing in Invoice.lineItems ever supplies a unit,
  // so it always rendered empty — removed per explicit request, with its
  // width folded back into Particulars.
  const colSlDivX = MARGIN + 20;
  const colQtyDivX = MARGIN + CONTENT_W - 215;
  const colQtyRateDivX = MARGIN + CONTENT_W - 170;
  const colRateDivX = MARGIN + CONTENT_W - 65;

  const colParticularsX = colSlDivX + 6;
  const colQtyX = colQtyDivX + 6;
  const colRateRightX = colRateDivX - 6;
  const colAmountRightX = MARGIN + CONTENT_W - 8;

  const drawTableHeaderRow = (): number => {
    const headerH = 20;
    const topY = y;
    page.drawRectangle({ x: MARGIN, y: topY - headerH, width: CONTENT_W, height: headerH, color: COLORS.headerBg });
    hLine(topY, MARGIN, MARGIN + CONTENT_W);
    page.drawText("Sl", { x: MARGIN + 4, y: topY - 13, size: 8, font: bold });
    page.drawText("No.", { x: MARGIN + 4, y: topY - 21, size: 6.5, font: bold });
    page.drawText("Particulars", { x: colParticularsX, y: topY - 13, size: 8, font: bold });
    page.drawText("Quantity", { x: colQtyX, y: topY - 13, size: 8, font: bold });
    drawRightAligned("Rate", colRateRightX, topY - 13, 8, bold);
    drawRightAligned("Amount", colAmountRightX, topY - 13, 8, bold);
    vLine(colSlDivX, topY, topY - headerH);
    vLine(colQtyDivX, topY, topY - headerH);
    vLine(colQtyRateDivX, topY, topY - headerH);
    vLine(colRateDivX, topY, topY - headerH);
    // Outer left/right borders through the header row itself — without
    // these, the table's side borders visibly break at the shaded header
    // (they resumed only inside closeTableSection, which spans just the
    // body rows below), leaving a gap at the top corners of the table.
    vLine(MARGIN, topY, topY - headerH);
    vLine(MARGIN + CONTENT_W, topY, topY - headerH);
    return topY - headerH;
  };

  y = drawTableHeaderRow();
  const tableColXs = [MARGIN, colSlDivX, colQtyDivX, colQtyRateDivX, colRateDivX, MARGIN + CONTENT_W];

  // The reference bills the whole compliance package as one numbered item
  // followed by unnumbered sub-lines (govt fees, then CGST/SGST as their own
  // particulars rows within the same bordered block) before the ruled total.
  // Our Invoice.lineItems is a flat list — render each as its own row, with
  // only the first row carrying the Sl No., matching that visual convention
  // when there's a single conceptual line item; multiple real line items
  // each get numbered normally.
  const rowH = 15;
  const minTableBodyH = 220; // keeps the table roughly the reference's height even with few rows
  const totalRowH = 22;

  const descMaxWidth = colQtyX - 6 - colParticularsX - 6;
  const measuredRows = invoice.lineItems.map((item) => {
    const lines = wrapText(item.description, regular, 9, descMaxWidth);
    return { item, lines, height: Math.max(rowH, lines.length * 11 + 4) };
  });

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

  // Every drawable row in the table body, in order — line items, then GST,
  // then discount. Building one flat list lets the pagination loop below
  // page-break at any row boundary without special-casing which kind of
  // row it is.
  type BodyRow = { draw: (rowY: number) => void; height: number };
  const bodyRows: BodyRow[] = measuredRows.map(({ item, lines }, idx) => ({
    height: Math.max(rowH, lines.length * 11 + 4),
    draw: (rowY) => {
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
    },
  }));
  for (const g of gstRows) {
    bodyRows.push({
      height: rowH,
      draw: (rowY) => {
        page.drawText(g.label, { x: colParticularsX, y: rowY - 12, size: 9, font: regular });
        // The percentage is a rate, not a quantity — belongs under the Rate
        // column (otherwise blank for these rows), not borrowing Quantity's
        // position the way an earlier version did.
        drawRightAligned(g.rate, colRateRightX, rowY - 12, 9, regular);
        drawRightAligned(formatMoney(g.amount), colAmountRightX, rowY - 12, 9, regular);
      },
    });
  }
  if (invoice.discount > 0) {
    bodyRows.push({
      height: rowH,
      draw: (rowY) => {
        page.drawText("Discount", { x: colParticularsX, y: rowY - 12, size: 9, font: regular });
        drawRightAligned(`(-) ${formatMoney(invoice.discount)}`, colAmountRightX, rowY - 12, 9, regular);
      },
    });
  }

  const contentRowsH = bodyRows.reduce((sum, r) => sum + r.height, 0);

  // Draws the column-divider rules for one page's worth of table body,
  // [sectionTopY, sectionBottomY], then the horizontal rule closing it off.
  const closeTableSection = (sectionTopY: number, sectionBottomY: number) => {
    for (let i = 1; i < tableColXs.length - 1; i++) {
      vLine(tableColXs[i], sectionTopY, sectionBottomY);
    }
    vLine(MARGIN, sectionTopY, sectionBottomY);
    vLine(MARGIN + CONTENT_W, sectionTopY, sectionBottomY);
    hLine(sectionBottomY, MARGIN, MARGIN + CONTENT_W);
  };

  // Reserve space below the table for whatever always follows it on the
  // same page. A row that isn't the table's last only needs to fit itself
  // plus headroom for one more row (so a page never ends with zero rows
  // drawn); the LAST row additionally needs the Total row plus enough for
  // Amount-Chargeable and the start of the signature block to not be
  // forced onto yet another page by themselves — GST summary/bank details
  // can still spill to a following page on their own if genuinely needed,
  // but the common case (no GST table, short bank details) should land
  // fully on the same page as the last line item.
  const footerReserve = 140; // Total row + Amount-Chargeable + start of signature block
  const minUsableY = MARGIN + 40;

  let tableTop = y;
  let rowY = tableTop;
  let rowsDrawnOnThisPage = 0;

  for (let i = 0; i < bodyRows.length; i++) {
    const row = bodyRows[i];
    const isLastRow = i === bodyRows.length - 1;
    const trailingReserve = isLastRow ? footerReserve : rowH;
    if (rowY - row.height - trailingReserve < minUsableY && rowsDrawnOnThisPage > 0) {
      // This row doesn't fit — close out the current page's table section
      // and continue on a fresh page with a repeated header.
      closeTableSection(tableTop, rowY);
      drawCentered("(Continued on next page)", PAGE_W / 2, rowY - 12, 7.5, regular, COLORS.slate);
      newPage();
      y = drawTableHeaderRow();
      tableTop = y;
      rowY = tableTop;
      rowsDrawnOnThisPage = 0;
    }
    row.draw(rowY);
    rowY -= row.height;
    rowsDrawnOnThisPage++;
  }

  // Pad the last page's table out to its usual minimum look when the
  // content is short (a single line item shouldn't produce a tiny table),
  // but never past what's actually left on the page.
  const remainingOnPage = rowY - minUsableY;
  const padding = Math.max(0, Math.min(minTableBodyH - contentRowsH, remainingOnPage));
  const tableBottom = rowY - Math.max(0, padding);

  // Column rules for this page's table body, then the Total row. PDF's
  // y-axis increases upward, so a row spanning [rowBottomY, rowTopY] must
  // keep its text baseline BELOW rowTopY by less than the row's own
  // height, i.e. baseline = rowTopY - offset with offset < rowHeight.
  // Getting this backwards (text placed outside the row it's meant to be
  // in) is exactly what produced the Total/Amount-Chargeable overlap here
  // originally — confirmed by direct baseline-coordinate logging, not just
  // eyeballing the render.
  const totalRowTopY = tableBottom;
  const totalRowBottomY = totalRowTopY - totalRowH;
  closeTableSection(tableTop, totalRowBottomY);

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

    // Rate % is left-aligned with a small inset from its cell's own left
    // divider, not centered on the whole rate+amount cell — centering put
    // it visually close to the divider anyway once the amount's own
    // right-aligned width was accounted for, reading as if it were crowding
    // the border line.
    const pctInset = 6;
    const dataRowH = 15;
    const taxAmount = (invoice.cgstAmount ?? 0) + (invoice.sgstAmount ?? 0) + (invoice.igstAmount ?? 0);
    drawRightAligned(formatMoney(invoice.subtotal), colTaxable, y - 11, 8.5, regular);
    if (invoice.gstType === "CGST_SGST") {
      page.drawText(`${invoice.cgstPercent ?? 0}%`, { x: colTaxable + 4 + pctInset, y: y - 11, size: 8.5, font: regular });
      drawRightAligned(formatMoney(invoice.cgstAmount ?? 0), colCgstAmt, y - 11, 8.5, regular);
      page.drawText(`${invoice.sgstPercent ?? 0}%`, { x: colCgstAmt + 4 + pctInset, y: y - 11, size: 8.5, font: regular });
      drawRightAligned(formatMoney(invoice.sgstAmount ?? 0), colSgstAmt, y - 11, 8.5, regular);
    } else {
      page.drawText(`${invoice.igstPercent ?? 0}%`, { x: colTaxable + 4 + pctInset, y: y - 11, size: 8.5, font: regular });
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

  // The signature block ("for X" / signature image / "Authorised
  // Signatory") always needs room regardless of whether bank details
  // render — this is what previously overlapped when there were no bank
  // details to pad the block out, and separately had no actual signature
  // image at all.
  const SIGNATURE_IMG_H = 34;
  const minSignatureBlockH = 20 + SIGNATURE_IMG_H + 16; // "for X" + image + "Authorised Signatory"
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

  // Seal sits behind/left of the signature, signature on top — same layered
  // convention sparksOfferLetterService.ts already uses elsewhere in this app.
  const sigBlockRightX = MARGIN + CONTENT_W - 8;
  const sigImgTopY = bankTop - 18;
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

  drawRightAligned("Authorised Signatory", sigBlockRightX, bankTop - bankBlockH + 10, 8, regular, COLORS.slate);

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
