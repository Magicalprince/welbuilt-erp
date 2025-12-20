/**
 * Seed Data Script
 *
 * Run this script once to initialize Firestore with:
 * - Company settings
 * - Founder users (after creating them in Firebase Auth)
 *
 * Usage:
 * 1. First create users in Firebase Auth console with their emails
 * 2. Get their user IDs
 * 3. Update the FOUNDER_USER_IDS below
 * 4. Run: npx ts-node src/scripts/seedData.ts
 *    OR import and call seedAllData() from your app
 */

import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { COLLECTIONS } from "@/services/firestore";

// ============================================
// UPDATE THESE WITH ACTUAL FIREBASE AUTH USER IDS
// ============================================
const FOUNDER_USER_IDS = {
  RAMACHANDRAA: "REPLACE_WITH_ACTUAL_USER_ID_1",
  ROHITH: "REPLACE_WITH_ACTUAL_USER_ID_2",
  BARANITHARAN: "REPLACE_WITH_ACTUAL_USER_ID_3",
};

// Founder data
const FOUNDERS = [
  {
    id: FOUNDER_USER_IDS.RAMACHANDRAA,
    name: "Ramachandraa PS",
    email: "ramachandraa@welbuilt.ai", // Replace with actual email
    equityPercent: 34,
    role: "FOUNDER" as const,
  },
  {
    id: FOUNDER_USER_IDS.ROHITH,
    name: "Rohith Babu ME",
    email: "rohith@welbuilt.ai", // Replace with actual email
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
  {
    id: FOUNDER_USER_IDS.BARANITHARAN,
    name: "Baranitharan S",
    email: "baranitharan@welbuilt.ai", // Replace with actual email
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
];

// Company settings
const COMPANY_SETTINGS = {
  companyName: "WelBuilt AI Solutions",
  companyEmail: "contact@welbuilt.ai",
  invoicePrefix: "INV",
  currency: "INR",
  currencySymbol: "₹",
  dateFormat: "DD/MM/YYYY",
  fiscalYearStart: 4, // April
};

/**
 * Seed founders into Firestore
 */
export async function seedFounders(): Promise<void> {
  console.log("🌱 Seeding founders...");

  for (const founder of FOUNDERS) {
    // Skip if ID not set
    if (founder.id.startsWith("REPLACE_WITH")) {
      console.warn(`⚠️  Skipping ${founder.name} - user ID not set`);
      continue;
    }

    const userRef = doc(db, COLLECTIONS.USERS, founder.id);
    await setDoc(userRef, {
      ...founder,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`✅ Created founder: ${founder.name}`);
  }

  console.log("✅ Founders seeded successfully!");
}

/**
 * Seed company settings into Firestore
 */
export async function seedSettings(): Promise<void> {
  console.log("🌱 Seeding company settings...");

  const settingsRef = doc(db, COLLECTIONS.SETTINGS, "company");
  await setDoc(settingsRef, {
    ...COMPANY_SETTINGS,
    updatedAt: Timestamp.now(),
  });

  console.log("✅ Company settings seeded successfully!");
}

/**
 * Seed all initial data
 */
export async function seedAllData(): Promise<void> {
  console.log("🚀 Starting seed process...\n");

  try {
    await seedSettings();
    await seedFounders();
    console.log("\n🎉 All seed data created successfully!");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    throw error;
  }
}

/**
 * Check if data already exists
 */
export async function checkExistingData(): Promise<{
  hasSettings: boolean;
  hasFounders: boolean;
}> {
  const { getDocument, getDocuments } = await import("@/services/firestore");

  const settings = await getDocument(COLLECTIONS.SETTINGS, "company");
  const users = await getDocuments(COLLECTIONS.USERS);

  return {
    hasSettings: !!settings,
    hasFounders: users.length > 0,
  };
}

// Export for use in components
export { FOUNDERS, COMPANY_SETTINGS, FOUNDER_USER_IDS };
