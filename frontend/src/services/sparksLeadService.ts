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
  toTimestamp,
} from "./firestore";
import type { SparksLead, SparksLeadFollowUp, SparksLeadStatus } from "@/types";
import { logLeadCreated, logLeadStatusChanged, logLeadConverted } from "./activityLogService";

export interface FirestoreSparksLead {
  id: string;
  leadName: string;
  contactNumber: string;
  source: SparksLead["source"];
  projectName: string;
  description: string;
  email?: string;
  address?: string;
  quotedAmount?: number;
  quotationNotes?: string;
  referrerId?: string;
  commissionType?: SparksLead["commissionType"];
  commissionValue?: number;
  commissionStatus?: SparksLead["commissionStatus"];
  status: SparksLeadStatus;
  dropReason?: string;
  nextFollowUpDate?: Timestamp;
  convertedClientId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

function toSparksLead(doc: FirestoreSparksLead): SparksLead {
  return {
    ...doc,
    nextFollowUpDate: doc.nextFollowUpDate?.toDate(),
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

export async function getSparksLeadById(id: string): Promise<SparksLead | null> {
  const lead = await getDocument<FirestoreSparksLead>(COLLECTIONS.SPARKS_LEADS, id);
  if (!lead) return null;
  return toSparksLead(lead);
}

export async function getAllSparksLeads(): Promise<SparksLead[]> {
  const leads = await getDocuments<FirestoreSparksLead>(
    COLLECTIONS.SPARKS_LEADS,
    orderBy("createdAt", "desc")
  );
  return leads.map(toSparksLead);
}

export async function getSparksLeadsByReferrer(referrerId: string): Promise<SparksLead[]> {
  const leads = await getDocuments<FirestoreSparksLead>(
    COLLECTIONS.SPARKS_LEADS,
    where("referrerId", "==", referrerId)
  );
  return leads.map(toSparksLead).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function createSparksLead(
  data: Omit<SparksLead, "id" | "status" | "createdAt" | "updatedAt">,
  userId: string
): Promise<string> {
  const leadId = await createDocument(COLLECTIONS.SPARKS_LEADS, {
    ...data,
    nextFollowUpDate: data.nextFollowUpDate ? toTimestamp(data.nextFollowUpDate) : undefined,
    status: "NEW" as SparksLeadStatus,
  });
  await logLeadCreated(userId, leadId, data.leadName);
  return leadId;
}

export async function updateSparksLead(
  id: string,
  data: Partial<Omit<SparksLead, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.nextFollowUpDate) updateData.nextFollowUpDate = toTimestamp(data.nextFollowUpDate);
  await updateDocument(COLLECTIONS.SPARKS_LEADS, id, updateData);
}

// Status change with audit logging — dropReason should already be set on
// `data` by the caller when transitioning to DROPPED.
export async function changeSparksLeadStatus(
  id: string,
  newStatus: SparksLeadStatus,
  userId: string,
  dropReason?: string
): Promise<void> {
  const lead = await getSparksLeadById(id);
  if (!lead) throw new Error("Lead not found");

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "DROPPED") updateData.dropReason = dropReason || "";

  await updateDocument(COLLECTIONS.SPARKS_LEADS, id, updateData);
  await logLeadStatusChanged(userId, id, lead.leadName, lead.status, newStatus);
}

export async function deleteSparksLead(id: string): Promise<void> {
  const followUps = await getFollowUpsByLead(id);
  await Promise.all(
    followUps.map((f) => deleteDocument(COLLECTIONS.SPARKS_LEAD_FOLLOWUPS, f.id))
  );
  await deleteDocument(COLLECTIONS.SPARKS_LEADS, id);
}

// ============================================
// Follow-ups
// ============================================

export interface FirestoreSparksLeadFollowUp {
  id: string;
  leadId: string;
  date: Timestamp;
  note: string;
  loggedBy: string;
  createdAt: Timestamp;
}

function toFollowUp(doc: FirestoreSparksLeadFollowUp): SparksLeadFollowUp {
  return {
    ...doc,
    date: doc.date.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

export async function getFollowUpsByLead(leadId: string): Promise<SparksLeadFollowUp[]> {
  const followUps = await getDocuments<FirestoreSparksLeadFollowUp>(
    COLLECTIONS.SPARKS_LEAD_FOLLOWUPS,
    where("leadId", "==", leadId)
  );
  return followUps.map(toFollowUp).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Logs a follow-up and optionally updates the lead's nextFollowUpDate in one call.
export async function addFollowUp(
  leadId: string,
  note: string,
  loggedBy: string,
  nextFollowUpDate?: Date
): Promise<string> {
  const followUpId = await createDocument(COLLECTIONS.SPARKS_LEAD_FOLLOWUPS, {
    leadId,
    date: Timestamp.now(),
    note,
    loggedBy,
  });

  if (nextFollowUpDate) {
    await updateDocument(COLLECTIONS.SPARKS_LEADS, leadId, {
      nextFollowUpDate: toTimestamp(nextFollowUpDate),
    });
  }

  return followUpId;
}

// ============================================
// Convert to Client
// ============================================

export interface ConvertLeadResult {
  clientId: string;
  wasLinkedToExisting: boolean;
}

// Finds an existing client by email or phone match, for the "link vs create" prompt.
export async function findMatchingClient(
  email?: string,
  phone?: string
): Promise<{ id: string; companyName: string } | null> {
  const { getAllClients } = await import("./clientService");
  const clients = await getAllClients();

  const match = clients.find(
    (c) =>
      (email && c.email && c.email.toLowerCase() === email.toLowerCase()) ||
      (phone && c.phone && c.phone === phone)
  );

  return match ? { id: match.id, companyName: match.companyName } : null;
}

// Converts a lead to a Client. If `linkToClientId` is provided, links to that
// existing client instead of creating a new one (used after findMatchingClient
// surfaces a match and the founder confirms linking rather than duplicating).
export async function convertSparksLeadToClient(
  leadId: string,
  userId: string,
  linkToClientId?: string
): Promise<ConvertLeadResult> {
  const lead = await getSparksLeadById(leadId);
  if (!lead) throw new Error("Lead not found");
  if (lead.status === "CONVERTED") throw new Error("Lead is already converted");
  if (lead.status === "DROPPED") throw new Error("Cannot convert a dropped lead");

  let clientId: string;
  let wasLinkedToExisting: boolean;

  if (linkToClientId) {
    clientId = linkToClientId;
    wasLinkedToExisting = true;
  } else {
    const { createClient } = await import("./clientService");
    clientId = await createClient({
      companyName: lead.leadName,
      contactPerson: lead.leadName,
      email: lead.email || "",
      phone: lead.contactNumber,
      address: lead.address,
      status: "ACTIVE",
      source: lead.source,
      notes: `Converted from Sparks AI lead (${lead.projectName})`,
    });
    wasLinkedToExisting = false;
  }

  await updateDocument(COLLECTIONS.SPARKS_LEADS, leadId, {
    status: "CONVERTED" as SparksLeadStatus,
    convertedClientId: clientId,
  });

  await logLeadConverted(userId, leadId, lead.leadName, clientId);

  return { clientId, wasLinkedToExisting };
}
