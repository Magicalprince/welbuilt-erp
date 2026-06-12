import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { INTERN_MODE_LABELS } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternOfferLetter } from "./internService";

// Format date as "DD/MM/YYYY"
function formatDateDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface OfferLetterData {
  name: string;
  domain: string;
  startDate: Date;
  endDate: Date;
  mode: string;
  stipend: number;
  projectTitle: string;
}

// Generate offer letter PDF using template - keep header/footer, replace middle content
export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Uint8Array> {
  // Load the template PDF
  const templateUrl = "/templates/offer-letter-template.pdf";
  const templateResponse = await fetch(templateUrl);
  const templateBytes = await templateResponse.arrayBuffer();

  // Load the PDF document
  const pdfDoc = await PDFDocument.load(templateBytes);

  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);

  // Load Poppins fonts
  let regularFont;
  let boldFont;

  try {
    const regularFontResponse = await fetch("/fonts/Poppins-Regular.ttf");
    const regularFontBytes = await regularFontResponse.arrayBuffer();
    regularFont = await pdfDoc.embedFont(regularFontBytes);

    const boldFontResponse = await fetch("/fonts/Poppins-Bold.ttf");
    const boldFontBytes = await boldFontResponse.arrayBuffer();
    boldFont = await pdfDoc.embedFont(boldFontBytes);
  } catch {
    // Fallback to standard fonts if custom fonts fail to load
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // Get the first page
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();

  // Colors
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  // Format dates
  const startDateStr = formatDateDDMMYYYY(data.startDate);
  const endDateStr = formatDateDDMMYYYY(data.endDate);

  // Layout constants
  const leftMargin = 52;
  const fontSize = 10;
  const lineHeight = 16;

  // === COVER ONLY THE MIDDLE CONTENT AREA ===
  // Keep the logo at top (above y=745) and footer at bottom intact
  // Footer includes: "WELBUILT AI SOLUTIONS PRIVATE LIMITED" + contact info + ribbon (starts at ~y=115)
  // Cover full width from left edge to right edge
  page.drawRectangle({
    x: 0,
    y: 115,
    width: width,
    height: 630, // From y=115 to y=745
    color: white,
  });

  // === LETTER CONTENT ===
  let currentY = height - 115; // Start below the logo

  // Dear Name
  page.drawText(`Dear ${data.name},`, {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // First paragraph
  currentY -= 28;

  // Line 1 with bold domain
  let xPos = leftMargin;
  const p1Part1 = "We are pleased to extend an offer to you for the position of ";
  page.drawText(p1Part1, { x: xPos, y: currentY, size: fontSize, font: regularFont, color: black });
  xPos += regularFont.widthOfTextAtSize(p1Part1, fontSize);

  page.drawText(data.domain, { x: xPos, y: currentY, size: fontSize, font: boldFont, color: black });
  xPos += boldFont.widthOfTextAtSize(data.domain, fontSize);

  page.drawText(" at Welbuilt AI", { x: xPos, y: currentY, size: fontSize, font: regularFont, color: black });

  // Line 2
  currentY -= lineHeight;
  page.drawText("Solutions Pvt Ltd. We believe your academic background and interest in research make you a", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Line 3
  currentY -= lineHeight;
  page.drawText("strong fit for our R&D initiatives.", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Position details section
  currentY -= 24;

  const details = [
    `Position: Intern - ${data.domain}`,
    "Department: IT",
    `Start Date: ${startDateStr}`,
    `End Date: ${endDateStr}`,
    `Mode: ${data.mode}`,
    `Stipend: ${data.stipend > 0 ? data.stipend.toString() : "Unpaid"}`,
  ];

  for (const detail of details) {
    page.drawText(detail, {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });
    currentY -= lineHeight;
  }

  // Project section
  currentY -= 8;
  page.drawText("During your internship, you will be working on a focused research project titled:", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= lineHeight + 2;
  page.drawText(`"${data.projectTitle}"`, {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: boldFont,
    color: black,
  });

  // Expectations paragraph
  currentY -= 24;
  page.drawText("You will be expected to contribute actively to team discussions, meet deadlines, and maintain", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("professional conduct throughout the internship.", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Tools paragraph
  currentY -= 20;
  page.drawText("The internship will provide hands-on experience using the latest tools, technologies, and", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("methodologies in the field, enabling you to build a strong foundation for your career.", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Stipend / educational nature paragraph
  currentY -= 20;
  if (data.stipend > 0) {
    page.drawText("Upon successful completion of the internship and all assigned deliverables, you will receive", {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });

    currentY -= lineHeight;
    page.drawText("an Internship Completion Certificate from Welbuilt AI Solutions Pvt Ltd.", {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });
  } else {
    page.drawText("This internship is purely educational in nature and does not include a stipend. Upon successful", {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });

    currentY -= lineHeight;
    page.drawText("completion of the internship and all assigned deliverables, you will receive an Internship", {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });

    currentY -= lineHeight;
    page.drawText("Completion Certificate from Welbuilt AI Solutions Pvt Ltd.", {
      x: leftMargin,
      y: currentY,
      size: fontSize,
      font: regularFont,
      color: black,
    });
  }

  // Closing
  currentY -= 24;
  page.drawText("We look forward to having you work with us.", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("Please confirm your acceptance of this offer at the earliest.", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Signature section
  currentY -= 32;
  const signatureStartY = currentY;

  // === COMPANY SEAL (drawn first so it appears behind the text) ===
  try {
    const sealResponse = await fetch("/images/seal.png");
    const sealBytes = await sealResponse.arrayBuffer();
    const sealImage = await pdfDoc.embedPng(new Uint8Array(sealBytes));

    // Seal image is 411x607 (portrait) — scale width to match so the circle isn't squashed
    const sealWidth = 150;
    const sealHeight = sealWidth * (607 / 411); // ~221 to preserve aspect ratio
    const sealX = leftMargin + 10;
    const sealY = signatureStartY - sealHeight + 60; // Centered behind the signature block

    page.drawImage(sealImage, {
      x: sealX,
      y: sealY,
      width: sealWidth,
      height: sealHeight,
      opacity: 0.15,
    });
  } catch {
    console.warn("Failed to load company seal image");
  }

  // Signature text (drawn on top of the seal)
  page.drawText("Warm Regards,", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= 20;
  page.drawText("Welbuilt AI Solutions Pvt Ltd", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: boldFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("Baranitharan S", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: boldFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("Chief Operational Officer (COO)", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  currentY -= lineHeight;
  page.drawText("HR Department", {
    x: leftMargin,
    y: currentY,
    size: fontSize,
    font: regularFont,
    color: black,
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// Generate offer letter and save locally (for preview/download)
export async function generateAndDownloadOfferLetter(
  intern: Intern,
  filename?: string,
  domainLabel?: string
): Promise<void> {
  const data: OfferLetterData = {
    name: intern.name,
    domain: domainLabel || intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    mode: intern.mode ? INTERN_MODE_LABELS[intern.mode] : "Remote",
    stipend: intern.stipend || 0,
    projectTitle: intern.projectTitle || "Research Project",
  };

  const pdfBytes = await generateOfferLetterPdf(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  const fileName = filename || `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_OfferLetter.pdf`;
  saveAs(blob, fileName);
}

// Generate offer letter and upload to R2
export async function generateAndUploadOfferLetter(
  intern: Intern & { id: string },
  domainLabel?: string
): Promise<{ offerLetterUrl: string; offerLetterKey: string }> {
  const data: OfferLetterData = {
    name: intern.name,
    domain: domainLabel || intern.domain,
    startDate: intern.startDate,
    endDate: intern.endDate,
    mode: intern.mode ? INTERN_MODE_LABELS[intern.mode] : "Remote",
    stipend: intern.stipend || 0,
    projectTitle: intern.projectTitle || "Research Project",
  };

  const pdfBytes = await generateOfferLetterPdf(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  const fileName = `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_OfferLetter.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  // Upload to R2 under interns/offer-letters folder
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/offer-letters");

  // Update the intern record with offer letter URL
  await updateInternOfferLetter(intern.id, fileUrl, fileKey);

  return { offerLetterUrl: fileUrl, offerLetterKey: fileKey };
}

// Bulk generate offer letters
export async function bulkGenerateOfferLetters(
  interns: Array<Intern & { id: string }>,
  onProgress?: (current: number, total: number, internName: string) => void
): Promise<Array<{ internId: string; success: boolean; error?: string }>> {
  const results: Array<{ internId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < interns.length; i++) {
    const intern = interns[i];

    try {
      if (onProgress) {
        onProgress(i + 1, interns.length, intern.name);
      }

      await generateAndUploadOfferLetter(intern);
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
