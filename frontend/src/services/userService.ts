import { doc, setDoc, Timestamp } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from "firebase/auth";
import { db, secondaryAuth } from "@/config/firebase";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  updateDocument,
  where,
} from "./firestore";
import type { User, UserRole } from "@/types";

export interface FirestoreUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  equityPercent: number;
  role: UserRole;
  isPlaceholder?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const user = await getDocument<FirestoreUser>(COLLECTIONS.USERS, userId);
  if (!user) return null;
  return {
    ...user,
    createdAt: user.createdAt.toDate(),
    updatedAt: user.updatedAt.toDate(),
  };
}

// Get all founders
export async function getAllFounders(): Promise<User[]> {
  try {
    const users = await getDocuments<FirestoreUser>(COLLECTIONS.USERS);

    // Filter out placeholders and duplicates (keep real users, not placeholders)
    const uniqueFounders = new Map<string, FirestoreUser>();

    for (const user of users) {
      if (user.role !== "FOUNDER") continue;

      // Skip placeholder entries if real user exists
      const isPlaceholder = user.id?.startsWith("placeholder_") || user.isPlaceholder === true;

      if (isPlaceholder) {
        // Only add placeholder if no real user with same email exists
        const realUserExists = users.some(
          (u) => u.email === user.email && !u.id?.startsWith("placeholder_") && u.isPlaceholder !== true
        );
        if (!realUserExists && !uniqueFounders.has(user.email)) {
          uniqueFounders.set(user.email, user);
        }
      } else {
        // Real user - always prefer over placeholder
        uniqueFounders.set(user.email, user);
      }
    }

    return Array.from(uniqueFounders.values())
      .map((user) => ({
        ...user,
        createdAt: user.createdAt?.toDate?.() || new Date(),
        updatedAt: user.updatedAt?.toDate?.() || new Date(),
      }))
      .sort((a, b) => b.equityPercent - a.equityPercent);
  } catch (error) {
    console.error("Error fetching founders:", error);
    return [];
  }
}

// Create user (used during initial setup)
export async function createUser(userId: string, data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<void> {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await setDoc(userRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<User, "name" | "phone" | "avatar">>
): Promise<void> {
  await updateDocument(COLLECTIONS.USERS, userId, data);
}

// Get founder finance data
export async function getFounderFinances(): Promise<{
  id: string;
  name: string;
  equityPercent: number;
  earnedShare: number;
  totalWithdrawals: number;
  availableBalance: number;
}[]> {
  try {
    const founders = await getAllFounders();

    if (!founders || founders.length === 0) {
      console.log("No founders found in database");
      return [];
    }

    // Get total revenue and operational expenses (excludes founder withdrawals —
    // withdrawals are a distribution of profit, not a cost that should shrink it)
    const { getTotalRevenue, getOperationalExpenses } = await import("./financeService");
    const totalRevenue = await getTotalRevenue();
    const operationalExpenses = await getOperationalExpenses();
    const netProfit = totalRevenue - operationalExpenses;

    // Get withdrawals and repayments for each founder
    const { getWithdrawalsByFounder } = await import("./withdrawalService");
    const { getTotalRepaymentsByFounder } = await import("./repaymentService");

    const founderFinances = await Promise.all(
      founders.map(async (founder) => {
        try {
          const [withdrawals, totalRepaid] = await Promise.all([
            getWithdrawalsByFounder(founder.id),
            getTotalRepaymentsByFounder(founder.id),
          ]);
          // Only count APPROVED withdrawals toward founder balance, net of repayments
          const totalWithdrawn = withdrawals
            .filter((w) => w.status === "APPROVED")
            .reduce((sum, w) => sum + w.amount, 0);
          const totalWithdrawals = totalWithdrawn - totalRepaid;
          const earnedShare = netProfit * (founder.equityPercent / 100);

          return {
            id: founder.id,
            name: founder.name,
            equityPercent: founder.equityPercent,
            earnedShare,
            totalWithdrawals,
            availableBalance: earnedShare - totalWithdrawals,
          };
        } catch (err) {
          console.error(`Error processing founder ${founder.name}:`, err);
          return {
            id: founder.id,
            name: founder.name,
            equityPercent: founder.equityPercent,
            earnedShare: 0,
            totalWithdrawals: 0,
            availableBalance: 0,
          };
        }
      })
    );

    return founderFinances;
  } catch (error) {
    console.error("Error in getFounderFinances:", error);
    return [];
  }
}

// Get all intern managers
export async function getAllInternManagers(): Promise<User[]> {
  try {
    const users = await getDocuments<FirestoreUser>(
      COLLECTIONS.USERS,
      where("role", "==", "INTERN_MANAGER")
    );
    return users.map((u) => ({
      ...u,
      createdAt: u.createdAt?.toDate?.() || new Date(),
      updatedAt: u.updatedAt?.toDate?.() || new Date(),
    }));
  } catch (error) {
    console.error("Error fetching intern managers:", error);
    return [];
  }
}

// Create an intern manager account (founders only)
// Uses a secondary Firebase Auth app so the founder's session is not affected
export async function createInternManager(
  name: string,
  email: string,
  password: string
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid = credential.user.uid;
  // Sign out from secondary app immediately so it doesn't hold a session
  await secondaryAuth.signOut();

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await setDoc(userRef, {
    name,
    email,
    equityPercent: 0,
    role: "INTERN_MANAGER" as UserRole,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return uid;
}

// Send password reset to an intern manager
export async function sendInternManagerPasswordReset(email: string): Promise<void> {
  await firebaseSendPasswordResetEmail(secondaryAuth, email);
}

// Deactivate intern manager (soft-delete by marking role)
export async function deleteInternManagerAccount(userId: string): Promise<void> {
  await updateDocument(COLLECTIONS.USERS, userId, { role: "DEACTIVATED" as UserRole });
}
