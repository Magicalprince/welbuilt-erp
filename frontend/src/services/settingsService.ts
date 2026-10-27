import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
} from "./firestore";

export interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string; // Optional URL
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
  invoicePrefix: string;
  invoiceTerms?: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  fiscalYearStart: number; // Month (1-12)
  // Ramachandraa's signature image, uploaded via the Salary page — no such
  // asset existed in the codebase before (only Baranitharan's, at the
  // fixed /images/sparks/signature.png path reused as-is). Optional until
  // uploaded; salarySlipPdfService.ts falls back to no signature image if
  // selected without one.
  ramachandraaSignatureUrl?: string;
  updatedAt: Date;
}

export interface FirestoreSettings {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
  invoicePrefix: string;
  invoiceTerms?: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  fiscalYearStart: number;
  ramachandraaSignatureUrl?: string;
  updatedAt: Timestamp;
}

const SETTINGS_DOC_ID = "company";

// Default settings
const DEFAULT_SETTINGS: Omit<FirestoreSettings, "updatedAt"> = {
  companyName: "WelBuilt AI Solutions",
  companyEmail: "contact@welbuilt.ai",
  invoicePrefix: "INV",
  currency: "INR",
  currencySymbol: "₹",
  dateFormat: "DD/MM/YYYY",
  fiscalYearStart: 4, // April
};

// Get company settings
export async function getCompanySettings(): Promise<CompanySettings> {
  const settings = await getDocument<FirestoreSettings>(
    COLLECTIONS.SETTINGS,
    SETTINGS_DOC_ID
  );

  if (!settings) {
    // Return defaults if not set
    return {
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
    };
  }

  return {
    ...settings,
    updatedAt: settings.updatedAt.toDate(),
  };
}

// Update company settings
export async function updateCompanySettings(
  data: Partial<Omit<CompanySettings, "updatedAt">>
): Promise<void> {
  const settingsRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);

  const currentSettings = await getCompanySettings();

  await setDoc(settingsRef, {
    ...currentSettings,
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Initialize settings (run once on first setup)
export async function initializeSettings(): Promise<void> {
  const existing = await getDocument<FirestoreSettings>(
    COLLECTIONS.SETTINGS,
    SETTINGS_DOC_ID
  );

  if (!existing) {
    const settingsRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      ...DEFAULT_SETTINGS,
      updatedAt: Timestamp.now(),
    });
  }
}

// Update bank details
export async function updateBankDetails(
  bankDetails: CompanySettings["bankDetails"]
): Promise<void> {
  await updateCompanySettings({ bankDetails });
}

// Update Ramachandraa's salary-slip signature image URL (uploaded via the
// Salary page). Baranitharan's signature is a fixed existing asset and
// needs no equivalent setter.
export async function updateRamachandraaSignature(url: string): Promise<void> {
  await updateCompanySettings({ ramachandraaSignatureUrl: url });
}

// Update invoice settings
export async function updateInvoiceSettings(
  invoicePrefix: string,
  invoiceTerms?: string
): Promise<void> {
  await updateCompanySettings({ invoicePrefix, invoiceTerms });
}

// Update company branding
export async function updateCompanyBranding(
  companyName: string,
  companyLogo?: string
): Promise<void> {
  await updateCompanySettings({ companyName, companyLogo });
}
