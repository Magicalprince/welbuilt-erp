import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternCertificate } from "./internService";

// ── Date helpers ────────────────────────────────────────────────────────────

function formatLong(date: Date): string {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function ordinalDay(n: number): string {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatLongOrdinal(date: Date): string {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${ordinalDay(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ── Image loader helper ──────────────────────────────────────────────────────

async function fetchImageBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

// ── Core PDF generator ───────────────────────────────────────────────────────

export interface SparksCertificateData {
  name: string;
  college: string;
  domain: string;
  duration: string;   // e.g. "2-Month"
  startDate: Date;
  endDate: Date;
  issueDate: Date;
}

export async function generateSparksCertificatePdf(data: SparksCertificateData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // A4 landscape: 841.89 x 595.28 pt
  const W = 841.89;
  const H = 595.28;
  const page = pdfDoc.addPage([W, H]);

  // ── Fonts ────────────────────────────────────────────────────────────────
  let bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  try {
    const [rb, bb] = await Promise.all([
      fetchImageBytes("/fonts/Montserrat-Regular.ttf"),
      fetchImageBytes("/fonts/Montserrat-Bold.ttf"),
    ]);
    if (rb) regular = await pdfDoc.embedFont(rb);
    if (bb) bold = await pdfDoc.embedFont(bb);
  } catch { /* use fallback */ }

  // ── Colours ─────────────────────────────────────────────────────────────
  const beige      = rgb(0.937, 0.906, 0.851);   // #EFE7D9 – warm parchment
  const black      = rgb(0, 0, 0);
  const gold       = rgb(0.784, 0.647, 0.078);   // #C8A514
  const navy       = rgb(0.098, 0.098, 0.271);   // #191945 – body text

  // ── Background ──────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: beige });

  // ── Top-right geometric block (black triangle + gold stripe) ────────────
  // Main black polygon (top-right corner trapezoid)
  page.drawRectangle({ x: 480, y: H - 220, width: W - 480, height: 220, color: black });
  // Diagonal cut on left edge: draw a beige triangle to "cut" the corner
  // We approximate the angled left edge with a thin gold bar first
  page.drawRectangle({ x: 460, y: H - 200, width: 30, height: 200, color: gold });
  page.drawRectangle({ x: 480, y: H - 220, width: 15, height: 220, color: gold });
  // Second angled cut creates the V-shape bottom indent
  page.drawRectangle({ x: 530, y: H - 260, width: W - 530, height: 45, color: black });
  page.drawRectangle({ x: 530, y: H - 260, width: 15, height: 45, color: gold });
  // Small gold accent line at very top
  page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: gold });
  // Bottom gold stripe
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: gold });

  // ── Logo (top-left) ─────────────────────────────────────────────────────
  const logoBytes = await fetchImageBytes("/images/sparks/logo.png");
  if (logoBytes) {
    const logoImg = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImg.scale(0.28);
    page.drawImage(logoImg, { x: 36, y: H - logoDims.height - 28, ...logoDims });
  } else {
    // Text fallback
    page.drawText("⚡ SPARKS AI", { x: 36, y: H - 60, size: 22, font: bold, color: black });
  }

  // ── Title block ─────────────────────────────────────────────────────────
  page.drawText("Internship", { x: 36, y: H - 175, size: 38, font: bold, color: black });
  page.drawText("Completion Certificate", { x: 36, y: H - 222, size: 38, font: bold, color: black });

  // ── Dedication line ──────────────────────────────────────────────────────
  page.drawText("This certificate dedicated to :", {
    x: 36, y: H - 265, size: 11, font: regular, color: navy,
  });

  // ── Intern name (large, underlined, black) ──────────────────────────────
  const nameSize = 36;
  const nameText = data.name.toUpperCase();
  const nameW = bold.widthOfTextAtSize(nameText, nameSize);
  const nameX = 36;
  const nameY = H - 315;

  page.drawText(nameText, { x: nameX, y: nameY, size: nameSize, font: bold, color: black });
  // Underline
  page.drawLine({
    start: { x: nameX, y: nameY - 4 },
    end:   { x: nameX + nameW, y: nameY - 4 },
    thickness: 2,
    color: black,
  });

  // ── Body paragraph ───────────────────────────────────────────────────────
  const durationLabel = data.duration.replace("-Month", " month").replace("-", " ").toLowerCase();
  const startStr = formatLongOrdinal(data.startDate);
  const endStr   = formatLongOrdinal(data.endDate);

  const line1Segs = [
    { text: "This is to certify that ", bold: false },
    { text: data.name, bold: true },
    { text: ", a student of ", bold: false },
    { text: data.college, bold: true },
    { text: " pursuing", bold: false },
  ];
  const line2Segs = [
    { text: data.domain, bold: true },
    { text: ", has successfully completed an internship in ", bold: false },
    { text: data.domain, bold: true },
    { text: " at ", bold: false },
    { text: "Sparks AI Solutions.", bold: true },
  ];
  const line3Segs = [
    { text: "The internship was conducted for a period of ", bold: false },
    { text: durationLabel, bold: true },
    { text: ", from ", bold: false },
    { text: startStr, bold: true },
    { text: " to ", bold: false },
    { text: endStr + ".", bold: true },
  ];

  const paraSize = 11;
  const paraLineH = 17;
  const maxW = 490;
  const paraX = 36;
  let paraY = H - 360;

  const drawWrappedMixed = (
    segs: { text: string; bold: boolean }[],
    startY: number,
    startX: number,
  ): number => {
    const words: { word: string; bold: boolean }[] = [];
    for (const seg of segs) {
      seg.text.split(" ").forEach((w) => { if (w) words.push({ word: w, bold: seg.bold }); });
    }

    const lineW = (ws: typeof words) =>
      ws.reduce((acc, w, i) => {
        const f = w.bold ? bold : regular;
        return acc + f.widthOfTextAtSize(w.word, paraSize) + (i < ws.length - 1 ? regular.widthOfTextAtSize(" ", paraSize) : 0);
      }, 0);

    let line: typeof words = [];
    let y = startY;

    const drawLine = (ws: typeof words) => {
      let x = startX;
      ws.forEach((w, i) => {
        const f = w.bold ? bold : regular;
        page.drawText(w.word, { x, y, size: paraSize, font: f, color: navy });
        x += f.widthOfTextAtSize(w.word, paraSize);
        if (i < ws.length - 1) x += regular.widthOfTextAtSize(" ", paraSize);
      });
      y -= paraLineH;
    };

    for (const wObj of words) {
      const test = [...line, wObj];
      if (lineW(test) > maxW && line.length > 0) { drawLine(line); line = [wObj]; }
      else { line.push(wObj); }
    }
    if (line.length > 0) drawLine(line);
    return y;
  };

  paraY = drawWrappedMixed(line1Segs, paraY, paraX);
  paraY = drawWrappedMixed(line2Segs, paraY, paraX);
  paraY -= 4; // small gap between para 1 and 2
  paraY = drawWrappedMixed(line3Segs, paraY, paraX);

  // ── Signature + Seal (bottom-right) ─────────────────────────────────────
  const sigAreaX = W - 230;
  const sigAreaY = 90;

  // Signature image
  const sigBytes = await fetchImageBytes("/images/sparks/signature.png");
  if (sigBytes) {
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDims = sigImg.scale(0.25);
    page.drawImage(sigImg, {
      x: sigAreaX + 20,
      y: sigAreaY + 28,
      width: sigDims.width,
      height: sigDims.height,
    });
  }

  // Seal image (overlapping with signature, slightly right)
  const sealBytes = await fetchImageBytes("/images/sparks/seal.png");
  if (sealBytes) {
    const sealImg = await pdfDoc.embedPng(sealBytes);
    const sealSize = 90;
    page.drawImage(sealImg, {
      x: sigAreaX + 110,
      y: sigAreaY + 20,
      width: sealSize,
      height: sealSize,
      opacity: 0.92,
    });
  }

  // Signature line
  page.drawLine({
    start: { x: sigAreaX, y: sigAreaY + 20 },
    end:   { x: W - 30,   y: sigAreaY + 20 },
    thickness: 1,
    color: navy,
  });

  // Name + title below line
  page.drawText("Ramachandraa P S", {
    x: sigAreaX + 10, y: sigAreaY + 6,
    size: 10, font: bold, color: black,
  });
  page.drawText("Director", {
    x: sigAreaX + 10, y: sigAreaY - 8,
    size: 9, font: regular, color: navy,
  });

  // ── Issue date (bottom-left) ─────────────────────────────────────────────
  page.drawText(`Date of Issue: ${formatLong(data.issueDate)}`, {
    x: 36, y: 28,
    size: 9, font: regular, color: navy,
  });

  // ── Certificate ID watermark (light, rotated) ────────────────────────────
  const certId = `SPARKS-${data.name.replace(/\s+/g, "").slice(0, 6).toUpperCase()}-${data.startDate.getFullYear()}`;
  page.drawText(certId, {
    x: 160, y: 22,
    size: 8, font: regular,
    color: rgb(0.6, 0.55, 0.45),
  });

  return pdfDoc.save();
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateAndDownloadSparksCertificate(
  intern: Intern,
  filename?: string,
): Promise<void> {
  const pdfBytes = await generateSparksCertificatePdf({
    name: intern.name,
    college: intern.college,
    domain: intern.domain,
    duration: intern.duration,
    startDate: intern.startDate,
    endDate: intern.endDate,
    issueDate: intern.issueDate,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const fileName = filename ?? `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Certificate.pdf`;
  saveAs(blob, fileName);
}

export async function generateAndUploadSparksCertificate(
  intern: Intern & { id: string },
): Promise<{ certificateUrl: string; certificateKey: string }> {
  const pdfBytes = await generateSparksCertificatePdf({
    name: intern.name,
    college: intern.college,
    domain: intern.domain,
    duration: intern.duration,
    startDate: intern.startDate,
    endDate: intern.endDate,
    issueDate: intern.issueDate,
  });
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const fileName = `SPARKS_${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Certificate.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/certificates/sparks");
  await updateInternCertificate(intern.id, fileUrl, fileKey);

  return { certificateUrl: fileUrl, certificateKey: fileKey };
}

export async function bulkGenerateSparksCertificates(
  interns: Array<Intern & { id: string }>,
  onProgress?: (current: number, total: number, internName: string) => void,
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];
    try {
      if (onProgress) onProgress(i + 1, interns.length, intern.name);
      await generateAndUploadSparksCertificate(intern);
      results.push({ internId: intern.internId, success: true });
    } catch (error) {
      results.push({
        internId: intern.internId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
