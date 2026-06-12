import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { saveAs } from "file-saver";
import type { Intern } from "@/types";
import { uploadFileToR2 } from "./r2Service";
import { updateInternCertificate } from "./internService";

// Format date as "DD/MM/YYYY"
function formatDateDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format date as "DD MONTH_NAME, YYYY"
function formatIssueDateLong(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
}

export interface CertificateData {
  name: string;
  domain: string;
  duration: string;
  startDate: Date;
  endDate: Date;
  issueDate: Date;
}

// Generate certificate PDF from template
// Cover entire text areas and redraw with proper formatting using Montserrat font
export async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  // Load the template PDF
  const templateUrl = "/templates/certificate-template.pdf";
  const templateResponse = await fetch(templateUrl);
  const templateBytes = await templateResponse.arrayBuffer();

  // Load the PDF document
  const pdfDoc = await PDFDocument.load(templateBytes);

  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);

  // Load Montserrat fonts
  let regularFont;
  let boldFont;

  try {
    const regularFontResponse = await fetch("/fonts/Montserrat-Regular.ttf");
    const regularFontBytes = await regularFontResponse.arrayBuffer();
    regularFont = await pdfDoc.embedFont(regularFontBytes);

    const boldFontResponse = await fetch("/fonts/Montserrat-Bold.ttf");
    const boldFontBytes = await boldFontResponse.arrayBuffer();
    boldFont = await pdfDoc.embedFont(boldFontBytes);
  } catch {
    // Fallback to standard fonts if custom fonts fail to load
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // Get the first page
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width: pageWidth } = firstPage.getSize();

  // Colors matching the certificate template
  const navyBlue = rgb(0.16, 0.18, 0.35); // #292E59 approximately
  const white = rgb(1, 1, 1);
  const darkRed = rgb(0.7, 0.15, 0.15); // For issue date - matching certificate red

  // === 1. NAME AREA ===
  // Cover the entire name line area generously
  firstPage.drawRectangle({
    x: 50,
    y: 318,
    width: 700,
    height: 55,
    color: white,
  });

  // Draw name centered with Montserrat Bold
  const nameText = data.name;
  const nameFontSize = 32;
  const nameWidth = boldFont.widthOfTextAtSize(nameText, nameFontSize);
  const nameX = (pageWidth - nameWidth) / 2;

  firstPage.drawText(nameText, {
    x: nameX,
    y: 335,
    size: nameFontSize,
    font: boldFont,
    color: navyBlue,
  });

  // === 2. MAIN PARAGRAPH AREA ===
  // Cover the entire paragraph area with extra margin to ensure all original text is hidden
  // Extended width to cover text bleeding on the right side
  firstPage.drawRectangle({
    x: 50,
    y: 195,
    width: 720,
    height: 120,
    color: white,
  });

  // Paragraph settings
  const paraFontSize = 11.5;
  const lineHeight = 17;
  const paraStartY = 290;
  const maxLineWidth = 580;

  // Build paragraph with segments (some regular, some bold)
  // Format: { text: string, bold: boolean }
  const startDateStr = formatDateDDMMYYYY(data.startDate);
  const endDateStr = formatDateDDMMYYYY(data.endDate);

  const paragraphSegments = [
    { text: "Congratulations on your outstanding achievement in ", bold: false },
    { text: data.domain, bold: true },
    { text: " at Welbuilt AI Solutions Pvt. Ltd. during the ", bold: false },
    { text: data.duration, bold: true },
    { text: " program held from ", bold: false },
    { text: startDateStr, bold: true },
    { text: " to ", bold: false },
    { text: endDateStr, bold: true },
    { text: ". Your hard work and dedication have truly paid off, and you should be incredibly proud of this accomplishment. Wishing you continued success in all your future endeavors!", bold: false },
  ];

  // Helper function to draw text with mixed fonts
  const drawMixedText = (segments: { text: string; bold: boolean }[], y: number) => {
    // Split all segments into words while preserving bold info
    const allWords: { word: string; bold: boolean }[] = [];

    for (const segment of segments) {
      const words = segment.text.split(" ");
      words.forEach((word, idx) => {
        if (word) {
          allWords.push({ word, bold: segment.bold });
        }
        // Add space handling - space belongs to the next word group
        if (idx < words.length - 1) {
          // Mark that next word should have a space before it
        }
      });
    }

    // Now process line by line
    let currentLineWords: { word: string; bold: boolean }[] = [];
    let currentY = y;

    const getLineWidth = (words: { word: string; bold: boolean }[]) => {
      let width = 0;
      words.forEach((w, idx) => {
        const font = w.bold ? boldFont : regularFont;
        width += font.widthOfTextAtSize(w.word, paraFontSize);
        if (idx < words.length - 1) {
          width += regularFont.widthOfTextAtSize(" ", paraFontSize);
        }
      });
      return width;
    };

    const drawLine = (words: { word: string; bold: boolean }[]) => {
      if (words.length === 0) return;

      const lineWidth = getLineWidth(words);
      let x = (pageWidth - lineWidth) / 2;

      words.forEach((w, idx) => {
        const font = w.bold ? boldFont : regularFont;
        firstPage.drawText(w.word, {
          x,
          y: currentY,
          size: paraFontSize,
          font,
          color: navyBlue,
        });
        x += font.widthOfTextAtSize(w.word, paraFontSize);
        if (idx < words.length - 1) {
          x += regularFont.widthOfTextAtSize(" ", paraFontSize);
        }
      });

      currentY -= lineHeight;
    };

    for (const wordObj of allWords) {
      const testWords = [...currentLineWords, wordObj];
      const testWidth = getLineWidth(testWords);

      if (testWidth > maxLineWidth && currentLineWords.length > 0) {
        drawLine(currentLineWords);
        currentLineWords = [wordObj];
      } else {
        currentLineWords.push(wordObj);
      }
    }

    // Draw remaining words
    if (currentLineWords.length > 0) {
      drawLine(currentLineWords);
    }
  };

  drawMixedText(paragraphSegments, paraStartY);

  // === 3. ISSUE DATE ===
  // Cover issue date area completely - extended to cover "YYYY" bleeding through
  firstPage.drawRectangle({
    x: 90,
    y: 135,
    width: 420,
    height: 45,
    color: white,
  });

  const issueDateText = `ISSUE DATE : ${formatIssueDateLong(data.issueDate)}`;

  firstPage.drawText(issueDateText, {
    x: 115,
    y: 152,
    size: 11,
    font: regularFont,
    color: darkRed,
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// Generate certificate and save locally (for preview/download)
export async function generateAndDownloadCertificate(
  intern: Intern,
  filename?: string,
  domainLabel?: string
): Promise<void> {
  const data: CertificateData = {
    name: intern.name,
    domain: domainLabel || intern.domain,
    duration: intern.duration,
    startDate: intern.startDate,
    endDate: intern.endDate,
    issueDate: intern.issueDate,
  };

  const pdfBytes = await generateCertificatePdf(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  const fileName = filename || `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Certificate.pdf`;
  saveAs(blob, fileName);
}

// Generate certificate and upload to R2
export async function generateAndUploadCertificate(
  intern: Intern & { id: string },
  domainLabel?: string
): Promise<{ certificateUrl: string; certificateKey: string }> {
  const data: CertificateData = {
    name: intern.name,
    domain: domainLabel || intern.domain,
    duration: intern.duration,
    startDate: intern.startDate,
    endDate: intern.endDate,
    issueDate: intern.issueDate,
  };

  const pdfBytes = await generateCertificatePdf(data);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  const fileName = `${intern.internId}_${intern.name.replace(/\s+/g, "_")}_Certificate.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  // Upload to R2 under interns/certificates folder
  const { fileUrl, fileKey } = await uploadFileToR2(file, "interns/certificates");

  // Update the intern record with certificate URL
  await updateInternCertificate(intern.id, fileUrl, fileKey);

  return { certificateUrl: fileUrl, certificateKey: fileKey };
}

// Bulk generate certificates
export async function bulkGenerateCertificates(
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

      await generateAndUploadCertificate(intern);
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

// Parse Excel/CSV file for bulk import
export async function parseInternFile(file: File): Promise<Array<{
  name: string;
  email: string;
  phone: string;
  college: string;
  year: string;
  domain: string;
  duration: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  paymentStatus: string;
}>> {
  const XLSX = await import("xlsx");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

        // Map and validate the data
        const interns = jsonData.map((row) => ({
          name: String(row["Name"] || row["name"] || ""),
          email: String(row["Email"] || row["email"] || ""),
          phone: String(row["Phone"] || row["phone"] || row["Contact"] || row["contact"] || ""),
          college: String(row["College"] || row["college"] || ""),
          year: String(row["Year"] || row["year"] || ""),
          domain: String(row["Domain"] || row["domain"] || ""),
          duration: String(row["Duration"] || row["duration"] || ""),
          startDate: String(row["Start Date"] || row["startDate"] || row["StartDate"] || ""),
          endDate: String(row["End Date"] || row["endDate"] || row["EndDate"] || ""),
          issueDate: String(row["Issue Date"] || row["issueDate"] || row["IssueDate"] || ""),
          paymentStatus: String(row["Payment Status"] || row["paymentStatus"] || row["Status"] || "UNPAID"),
        }));

        resolve(interns);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

// Validate parsed intern data
export function validateInternData(data: {
  name: string;
  email: string;
  phone: string;
  college: string;
  year: string;
  domain: string;
  duration: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  paymentStatus: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name?.trim()) errors.push("Name is required");
  if (!data.email?.trim()) errors.push("Email is required");
  if (!data.phone?.trim()) errors.push("Phone is required");
  if (!data.college?.trim()) errors.push("College is required");
  if (!data.year?.trim()) errors.push("Year is required");
  if (!data.domain?.trim()) errors.push("Domain is required");
  if (!data.duration?.trim()) errors.push("Duration is required");
  if (!data.startDate?.trim()) errors.push("Start Date is required");
  if (!data.endDate?.trim()) errors.push("End Date is required");

  return { valid: errors.length === 0, errors };
}

// Map duration string to InternDuration type
export function mapDurationString(duration: string): string {
  const durationMap: Record<string, string> = {
    "1 month": "1-Month",
    "1-month": "1-Month",
    "1month": "1-Month",
    "2 month": "2-Month",
    "2-month": "2-Month",
    "2month": "2-Month",
    "2 months": "2-Month",
    "3 month": "3-Month",
    "3-month": "3-Month",
    "3month": "3-Month",
    "3 months": "3-Month",
    "6 month": "6-Month",
    "6-month": "6-Month",
    "6month": "6-Month",
    "6 months": "6-Month",
  };

  const normalized = duration.toLowerCase().trim();
  return durationMap[normalized] || "1-Month";
}

// Parse date string to Date object — always returns a local-midnight Date (no timezone shift)
export function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Excel serial date (number)
  const numValue = Number(dateStr);
  if (!isNaN(numValue) && numValue > 30000 && numValue < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + numValue * 86400000);
    // Return local midnight to avoid DST edge cases
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }

  // YYYY-MM-DD (HTML date input format — MUST use local constructor to avoid UTC shift)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // Fallback: parse then convert back to local midnight
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return new Date();
  const d = new Date(parsed);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
