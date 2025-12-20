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
