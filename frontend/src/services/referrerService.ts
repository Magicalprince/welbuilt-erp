import { Timestamp } from "firebase/firestore";
import {
  COLLECTIONS,
  getDocument,
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  orderBy,
  where,
} from "./firestore";
import type { Referrer, ReferrerStats } from "@/types";

export interface FirestoreReferrer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toReferrer(doc: FirestoreReferrer): Referrer {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getReferrerById(id: string): Promise<Referrer | null> {
  const referrer = await getDocument<FirestoreReferrer>(COLLECTIONS.REFERRERS, id);
  if (!referrer) return null;
  return toReferrer(referrer);
}

export async function getAllReferrers(): Promise<Referrer[]> {
  const referrers = await getDocuments<FirestoreReferrer>(
    COLLECTIONS.REFERRERS,
    orderBy("name")
  );
  return referrers.map(toReferrer);
}

export async function createReferrer(
  data: Omit<Referrer, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument(COLLECTIONS.REFERRERS, data as Omit<FirestoreReferrer, "id">);
}

export async function updateReferrer(
  id: string,
  data: Partial<Omit<Referrer, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.REFERRERS, id, data);
}

// Blocks deletion if any lead still references this referrer — referential
// integrity, matching how other FK-like relations in this codebase behave.
export async function deleteReferrer(id: string): Promise<void> {
  const { getDocuments: getDocs } = await import("./firestore");
  const leadsReferencing = await getDocs(
    COLLECTIONS.SPARKS_LEADS,
    where("referrerId", "==", id)
  );
  if (leadsReferencing.length > 0) {
    throw new Error(
      `Cannot delete referrer: ${leadsReferencing.length} lead(s) still reference them`
    );
  }
  await deleteDocument(COLLECTIONS.REFERRERS, id);
}

// Aggregate a referrer's stats from the leads that reference them —
// computed at read time, never stored redundantly.
export async function getReferrerStats(referrerId: string): Promise<ReferrerStats | null> {
  const referrer = await getReferrerById(referrerId);
  if (!referrer) return null;

  const { getDocuments: getDocs } = await import("./firestore");
  const leads = await getDocs<Record<string, unknown>>(
    COLLECTIONS.SPARKS_LEADS,
    where("referrerId", "==", referrerId)
  );

  const totalReferred = leads.length;
  const totalConverted = leads.filter((l) => l.status === "CONVERTED").length;
  const commissionOwed = leads
    .filter((l) => l.commissionStatus === "OWED")
    .reduce((sum, l) => sum + (Number(l.commissionValue) || 0), 0);
  const commissionPaid = leads
    .filter((l) => l.commissionStatus === "PAID")
    .reduce((sum, l) => sum + (Number(l.commissionValue) || 0), 0);

  return {
    referrer,
    totalReferred,
    totalConverted,
    commissionOwed,
    commissionPaid,
  };
}

export async function getAllReferrersWithStats(): Promise<ReferrerStats[]> {
  const referrers = await getAllReferrers();
  return Promise.all(
    referrers.map(async (r) => {
      const stats = await getReferrerStats(r.id);
      return (
        stats || {
          referrer: r,
          totalReferred: 0,
          totalConverted: 0,
          commissionOwed: 0,
          commissionPaid: 0,
        }
      );
    })
  );
}
