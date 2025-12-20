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

export type CommunicationType = "EMAIL" | "CALL" | "MEETING" | "MESSAGE";

export interface Communication {
  id: string;
  type: CommunicationType;
  subject: string;
  content?: string;
  clientId?: string;
  projectId?: string;
  participants: string[]; // User IDs
  date: Date;
  duration?: number; // In minutes for calls/meetings
  outcome?: string;
  followUpDate?: Date;
  attachments?: string[]; // Optional - URLs
  createdBy: string;
  createdAt: Date;
}

export interface FirestoreCommunication {
  id: string;
  type: CommunicationType;
  subject: string;
  content?: string;
  clientId?: string;
  projectId?: string;
  participants: string[];
  date: Timestamp;
  duration?: number;
  outcome?: string;
  followUpDate?: Timestamp;
  attachments?: string[];
  createdBy: string;
  createdAt: Timestamp;
}

// Convert Firestore communication to Communication type
function toCommunication(doc: FirestoreCommunication): Communication {
  return {
    ...doc,
    date: doc.date.toDate(),
    followUpDate: doc.followUpDate?.toDate(),
    createdAt: doc.createdAt.toDate(),
  };
}

// Get communication by ID
export async function getCommunicationById(communicationId: string): Promise<Communication | null> {
  const communication = await getDocument<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    communicationId
  );
  if (!communication) return null;
  return toCommunication(communication);
}

// Get all communications
export async function getAllCommunications(): Promise<Communication[]> {
  const communications = await getDocuments<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    orderBy("date", "desc")
  );
  return communications.map(toCommunication);
}

// Get communications by client
export async function getCommunicationsByClient(clientId: string): Promise<Communication[]> {
  const communications = await getDocuments<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    where("clientId", "==", clientId),
    orderBy("date", "desc")
  );
  return communications.map(toCommunication);
}

// Get communications by project
export async function getCommunicationsByProject(projectId: string): Promise<Communication[]> {
  const communications = await getDocuments<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    where("projectId", "==", projectId),
    orderBy("date", "desc")
  );
  return communications.map(toCommunication);
}

// Get communications by type
export async function getCommunicationsByType(type: CommunicationType): Promise<Communication[]> {
  const communications = await getDocuments<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    where("type", "==", type),
    orderBy("date", "desc")
  );
  return communications.map(toCommunication);
}

// Get communications with follow-ups due
export async function getFollowUpsDue(): Promise<Communication[]> {
  const now = new Date();
  const communications = await getDocuments<FirestoreCommunication>(
    COLLECTIONS.COMMUNICATIONS,
    where("followUpDate", "<=", Timestamp.fromDate(now)),
    orderBy("followUpDate", "asc")
  );
  return communications.map(toCommunication);
}

// Get recent communications
export async function getRecentCommunications(limit: number = 10): Promise<Communication[]> {
  const communications = await getAllCommunications();
  return communications.slice(0, limit);
}

// Create communication
export async function createCommunication(
  data: Omit<Communication, "id" | "createdAt">
): Promise<string> {
  return createDocument(COLLECTIONS.COMMUNICATIONS, {
    ...data,
    date: Timestamp.fromDate(data.date),
    followUpDate: data.followUpDate ? Timestamp.fromDate(data.followUpDate) : null,
    attachments: data.attachments || [], // Optional
  });
}

// Update communication
export async function updateCommunication(
  communicationId: string,
  data: Partial<Omit<Communication, "id" | "createdAt">>
): Promise<void> {
  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = Timestamp.fromDate(data.date);
  if (data.followUpDate) updateData.followUpDate = Timestamp.fromDate(data.followUpDate);

  await updateDocument(COLLECTIONS.COMMUNICATIONS, communicationId, updateData);
}

// Delete communication
export async function deleteCommunication(communicationId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.COMMUNICATIONS, communicationId);
}

// Log email
export async function logEmail(
  data: {
    subject: string;
    content?: string;
    clientId?: string;
    projectId?: string;
    participants: string[];
    createdBy: string;
    followUpDate?: Date;
  }
): Promise<string> {
  return createCommunication({
    ...data,
    type: "EMAIL",
    date: new Date(),
  });
}

// Log call
export async function logCall(
  data: {
    subject: string;
    content?: string;
    clientId?: string;
    projectId?: string;
    participants: string[];
    duration?: number;
    outcome?: string;
    createdBy: string;
    followUpDate?: Date;
  }
): Promise<string> {
  return createCommunication({
    ...data,
    type: "CALL",
    date: new Date(),
  });
}

// Log meeting
export async function logMeeting(
  data: {
    subject: string;
    content?: string;
    clientId?: string;
    projectId?: string;
    participants: string[];
    date: Date;
    duration?: number;
    outcome?: string;
    createdBy: string;
    followUpDate?: Date;
  }
): Promise<string> {
  return createCommunication({
    ...data,
    type: "MEETING",
  });
}

// Clear follow-up
export async function clearFollowUp(communicationId: string): Promise<void> {
  await updateDocument(COLLECTIONS.COMMUNICATIONS, communicationId, {
    followUpDate: null,
  });
}

// Set follow-up date
export async function setFollowUp(
  communicationId: string,
  followUpDate: Date
): Promise<void> {
  await updateDocument(COLLECTIONS.COMMUNICATIONS, communicationId, {
    followUpDate: Timestamp.fromDate(followUpDate),
  });
}
