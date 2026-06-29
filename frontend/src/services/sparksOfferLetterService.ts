import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { INTERN_MODE_LABELS } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternOfferLetter } from "./internService";

// ── Design tokens ─────────────────────────────────────────────────────────────
// Sparks AI colour palette — teal + gold on warm off-white
// Intentionally distinct from WelBuilt's blue/navy/amber scheme

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLong(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatDDMMYYYY(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.arrayBuffer() : null;
  } catch { return null; }
}

// Wrap plain text into lines no wider than maxWidth pt
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

// ── Data interface ────────────────────────────────────────────────────────────

export interface SparksOfferLetterData {
  name: string;
  domain: string;
  startDate: Date;
  endDate: Date;
  mode: string;
  stipend: number;
  projectTitle: string;
  internId: string;
}

// ── Core PDF generator ────────────────────────────────────────────────────────

export async function generateSparksOfferLetterPdf(data: SparksOfferLetterData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // A4 portrait: 595.28 × 841.89 pt
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

  // ── Colours ───────────────────────────────────────────────────────────────
  const offWhite = rgb(0.961, 0.941, 0.910);   // #F5F0E8 warm page bg
  const teal     = rgb(0.051, 0.361, 0.388);   // #0D5C63 sidebar + headings
  const gold     = rgb(0.784, 0.647, 0.078);   // #C8A514 accents
  const dark     = rgb(0.10,  0.10,  0.10);    // body text
  const mid      = rgb(0.35,  0.35,  0.35);    // labels
  const white    = rgb(1, 1, 1);

  // ── Background ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: offWhite });

  // ── Left teal sidebar (80 pt wide) ────────────────────────────────────────
  const SB = 72; // sidebar width
  page.drawRectangle({ x: 0, y: 0, width: SB, height: H, color: teal });

  // Gold accent line on sidebar right edge — only below the header band
  page.drawRectangle({ x: SB, y: 0, width: 3, height: H - 80, color: gold });

  const logoBytes = await fetchBytes("/images/sparks/logo.png");

  // "SPARKS AI" vertical text on sidebar
  const sbText = "SPARKS AI";
  const sbSize = 9;
  const sbW = bold.widthOfTextAtSize(sbText, sbSize);
  page.drawText(sbText, {
    x: SB / 2 - sbW / 2,
    y: H / 2 - 60,
    size: sbSize,
    font: bold,
    color: white,
    opacity: 0.55,
  });

  // "INTERNSHIP OFFER" label on sidebar
  const sbLabel = "INTERNSHIP OFFER";
  const sbLW = regular.widthOfTextAtSize(sbLabel, 6.5);
  page.drawText(sbLabel, {
    x: SB / 2 - sbLW / 2,
    y: H / 2 - 74,
    size: 6.5,
    font: regular,
    color: white,
    opacity: 0.45,
  });

  // Ref number at bottom of sidebar
  page.drawText(data.internId, {
    x: 6,
    y: 24,
    size: 6,
    font: regular,
    color: white,
    opacity: 0.6,
  });

  // ── Content area ──────────────────────────────────────────────────────────
  const CX = SB + 20;   // content left margin
  const CW = W - CX - 24; // content width
  let Y = H - 36;

  // ── Top header bar — full width so no gap at sidebar junction ───────────────
  page.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: teal });

  // Logo on right side of header
  if (logoBytes) {
    const logoImg = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImg.scale(0.18);
    page.drawImage(logoImg, {
      x: W - logoDims.width - 20,
      y: H - (80 + logoDims.height) / 2 - logoDims.height / 2 + 10,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  // Company name
  page.drawText("SPARKS AI SOLUTIONS", {
    x: CX, y: H - 30,
    size: 14, font: bold, color: white,
  });
  page.drawText("Empowering Talent. Igniting Futures.", {
    x: CX, y: H - 46,
    size: 8, font: regular, color: white, opacity: 0.8,
  });

  // Address right-aligned in header
  const addr1 = "23/14 A, Ramalinganar 6th Street, Tiruvannamalai";
  const addr2 = "Tamil Nadu - 606601  |  sparksai.solutions";
  page.drawText(addr1, { x: CX, y: H - 62, size: 7, font: regular, color: white, opacity: 0.75 });
  page.drawText(addr2, { x: CX, y: H - 73, size: 7, font: regular, color: white, opacity: 0.75 });

  Y = H - 100;

  // ── Document title ────────────────────────────────────────────────────────
  page.drawText("INTERNSHIP OFFER LETTER", {
    x: CX, y: Y,
    size: 15, font: bold, color: teal,
  });
  // Gold underline
  page.drawRectangle({ x: CX, y: Y - 4, width: bold.widthOfTextAtSize("INTERNSHIP OFFER LETTER", 15), height: 2, color: gold });

  Y -= 22;
  page.drawText(`Date: ${formatLong(new Date())}`, {
    x: CX, y: Y, size: 8.5, font: regular, color: mid,
  });
  page.drawText(`Ref: ${data.internId}`, {
    x: W - 24 - regular.widthOfTextAtSize(`Ref: ${data.internId}`, 8.5), y: Y,
    size: 8.5, font: regular, color: mid,
  });

  Y -= 20;

  // ── Candidate info card ───────────────────────────────────────────────────
  page.drawRectangle({ x: CX - 6, y: Y - 42, width: CW + 12, height: 52, color: teal, opacity: 0.06 });

  page.drawText("Candidate", { x: CX, y: Y, size: 7, font: regular, color: teal });
  Y -= 13;
  page.drawText(data.name, { x: CX, y: Y, size: 13, font: bold, color: teal });
  Y -= 14;
  page.drawText(`Domain: ${data.domain}  |  Mode: ${data.mode}  |  Duration: ${formatDDMMYYYY(data.startDate)} – ${formatDDMMYYYY(data.endDate)}`, {
    x: CX, y: Y, size: 8, font: regular, color: mid,
  });

  Y -= 24;

  // ── Body text ─────────────────────────────────────────────────────────────
  const bodySize = 9.5;
  const lineH = 15;
  const drawPara = (text: string) => {
    const lines = wrapText(text, regular, bodySize, CW);
    for (const l of lines) {
      page.drawText(l, { x: CX, y: Y, size: bodySize, font: regular, color: dark });
      Y -= lineH;
    }
    Y -= 5;
  };

  drawPara(`Dear ${data.name},`);

  drawPara(
    `We are delighted to extend this offer of internship to you at Sparks AI Solutions, a brand under WelBuilt AI Solutions Pvt. Ltd. ` +
    `Following a thorough review of your profile and our selection process, we are pleased to confirm your selection for the role of ` +
    `Intern in the ${data.domain} domain.`
  );

  // ── Section: Internship Details ───────────────────────────────────────────
  Y -= 4;
  page.drawText("INTERNSHIP DETAILS", { x: CX, y: Y, size: 8.5, font: bold, color: teal });
  page.drawRectangle({ x: CX, y: Y - 3, width: CW, height: 0.75, color: gold });
  Y -= 18;

  const details: [string, string][] = [
    ["Role / Domain",    data.domain],
    ["Project Title",    data.projectTitle],
    ["Mode",            data.mode],
    ["Start Date",      formatLong(data.startDate)],
    ["End Date",        formatLong(data.endDate)],
    ["Stipend",         data.stipend > 0 ? `₹${data.stipend.toLocaleString("en-IN")} per month` : "Unpaid Internship"],
  ];

  const colL = CX;
  const colR = CX + 160;
  const rowH = 17;
  for (let i = 0; i < details.length; i++) {
    const rowY = Y - i * rowH;
    if (i % 2 === 0) {
      page.drawRectangle({ x: CX - 4, y: rowY - 4, width: CW + 8, height: rowH, color: teal, opacity: 0.05 });
    }
    page.drawText(details[i][0], { x: colL, y: rowY, size: 8.5, font: bold, color: mid });
    page.drawText(details[i][1], { x: colR, y: rowY, size: 8.5, font: regular, color: dark });
  }
  Y -= details.length * rowH + 12;

  // ── Body paras ────────────────────────────────────────────────────────────
  drawPara(
    `During your internship you will work on ${data.projectTitle}. You are expected to maintain professionalism, ` +
    `adhere to project timelines, attend all scheduled meetings, and deliver quality work as guided by your mentor.`
  );

  drawPara(
    `The internship shall be conducted in ${data.mode} mode commencing on ${formatLong(data.startDate)} ` +
    `and concluding on ${formatLong(data.endDate)}.`
  );

  if (data.stipend > 0) {
    drawPara(
      `A monthly stipend of ₹${data.stipend.toLocaleString("en-IN")} will be disbursed subject to satisfactory performance ` +
      `and attendance, as assessed by your reporting manager.`
    );
  } else {
    drawPara(
      `This internship is offered on an unpaid basis and is intended to provide hands-on industry experience and skill development.`
    );
  }

  drawPara(
    `Upon successful completion you will receive an Internship Completion Certificate from Sparks AI Solutions. ` +
    `We look forward to a productive and enriching journey together.`
  );

  Y -= 8;

  // ── Signature block ───────────────────────────────────────────────────────
  page.drawText("Warm Regards,", { x: CX, y: Y, size: 9.5, font: regular, color: dark });
  Y -= 14;

  // Signature image
  const sigBytes = await fetchBytes("/images/sparks/signature.png");
  if (sigBytes) {
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImg.scale(0.22);
    page.drawImage(sigImg, { x: CX, y: Y - sigDims.height + 10, width: sigDims.width, height: sigDims.height });
    Y -= sigDims.height + 4;
  } else {
    Y -= 28;
  }

  // Signature line
  page.drawRectangle({ x: CX, y: Y, width: 130, height: 0.75, color: teal });
  Y -= 12;
  page.drawText("Ramachandraa P S", { x: CX, y: Y, size: 9, font: bold, color: teal });
  Y -= 12;
  page.drawText("Director, Sparks AI Solutions", { x: CX, y: Y, size: 8, font: regular, color: mid });

  // Seal — right-aligned in signature block
  const sealBytes = await fetchBytes("/images/sparks/seal.png");
  if (sealBytes) {
    const sealImg = await pdfDoc.embedPng(sealBytes);
    const sealDims = sealImg.scale(0.20);
    page.drawImage(sealImg, {
      x: W - 24 - sealDims.width,
      y: Y - sealDims.height + 30,
      width: sealDims.width,
      height: sealDims.height,
      opacity: 0.88,
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = 36;
  page.drawRectangle({ x: SB, y: footerY - 4, width: W - SB, height: 0.75, color: gold });
  page.drawText(
    "This is a computer-generated document. Sparks AI Solutions is a brand under WelBuilt AI Solutions Pvt. Ltd.",
    { x: CX, y: footerY - 14, size: 6.5, font: regular, color: mid, opacity: 0.7 },
  );

  return pdfDoc.save();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateAndDownloadSparksOfferLetter(
  intern: Intern,
  filename?: string,
): Promise<void> {
  const pdfBytes = await generateSparksOfferLetterPdf({
    name: intern.name,
    domain: intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    mode: intern.mode ? INTERN_MODE_LABELS[intern.mode] : "Remote",
    stipend: intern.stipend ?? 0,
    projectTitle: intern.projectTitle ?? "Research Project",
    internId: intern.internId,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  saveAs(blob, filename ?? `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_OfferLetter.pdf`);
}

export async function generateAndUploadSparksOfferLetter(
  intern: Intern & { id: string },
): Promise<{ offerLetterUrl: string; offerLetterKey: string }> {
  const pdfBytes = await generateSparksOfferLetterPdf({
    name: intern.name,
    domain: intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    mode: intern.mode ? INTERN_MODE_LABELS[intern.mode] : "Remote",
    stipend: intern.stipend ?? 0,
    projectTitle: intern.projectTitle ?? "Research Project",
    internId: intern.internId,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const fileName = `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_OfferLetter.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/offer-letters/sparks");
  await updateInternOfferLetter(intern.id, fileUrl, fileKey);
  return { offerLetterUrl: fileUrl, offerLetterKey: fileKey };
}

export async function bulkGenerateSparksOfferLetters(
  interns: Array<Intern & { id: string }>,
  onProgress?: (current: number, total: number, name: string) => void,
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];
  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    try {
      onProgress?.(i + 1, interns.length, intern.name);
      await generateAndUploadSparksOfferLetter(intern);
      results.push({ internId: intern.internId, success: true });
    } catch (err) {
      results.push({ internId: intern.internId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return results;
}
