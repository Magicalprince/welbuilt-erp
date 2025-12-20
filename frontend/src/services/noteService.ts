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
import type { Note, NoteCheckpoint } from "@/types";

export interface FirestoreNote {
  id: string;
  title: string;
  content: string;
  projectId?: string;
  clientId?: string;
  isPinned: boolean;
  checkpoints: {
    id: string;
    text: string;
    isChecked: boolean;
  }[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Convert Firestore note to Note type
function toNote(doc: FirestoreNote): Note {
  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
}

// Get note by ID
export async function getNoteById(noteId: string): Promise<Note | null> {
  const note = await getDocument<FirestoreNote>(COLLECTIONS.NOTES, noteId);
  if (!note) return null;
  return toNote(note);
}

// Get all notes
export async function getAllNotes(): Promise<Note[]> {
  const notes = await getDocuments<FirestoreNote>(
    COLLECTIONS.NOTES,
    orderBy("updatedAt", "desc")
  );
  return notes.map(toNote);
}

// Get notes by project
export async function getNotesByProject(projectId: string): Promise<Note[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const notes = await getDocuments<FirestoreNote>(
    COLLECTIONS.NOTES,
    where("projectId", "==", projectId)
  );
  return notes.map(toNote).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Get notes by client
export async function getNotesByClient(clientId: string): Promise<Note[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const notes = await getDocuments<FirestoreNote>(
    COLLECTIONS.NOTES,
    where("clientId", "==", clientId)
  );
  return notes.map(toNote).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Get pinned notes
export async function getPinnedNotes(): Promise<Note[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const notes = await getDocuments<FirestoreNote>(
    COLLECTIONS.NOTES,
    where("isPinned", "==", true)
  );
  return notes.map(toNote).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Get notes by creator
export async function getNotesByCreator(userId: string): Promise<Note[]> {
  // Fetch without orderBy to avoid composite index requirement, sort in-memory
  const notes = await getDocuments<FirestoreNote>(
    COLLECTIONS.NOTES,
    where("createdBy", "==", userId)
  );
  return notes.map(toNote).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// Create note
export async function createNote(
  data: Omit<Note, "id" | "createdAt" | "updatedAt" | "checkpoints"> & {
    checkpoints?: { text: string; isChecked: boolean }[];
  }
): Promise<string> {
  const checkpoints = (data.checkpoints || []).map((cp, index) => ({
    id: `checkpoint-${Date.now()}-${index}`,
    text: cp.text,
    isChecked: cp.isChecked,
  }));

  try {
    const noteData = {
      title: data.title,
      content: data.content,
      isPinned: data.isPinned || false,
      createdBy: data.createdBy,
      checkpoints,
      ...(data.projectId && { projectId: data.projectId }),
      ...(data.clientId && { clientId: data.clientId }),
    };
    console.log("Creating note with data:", noteData);
    const id = await createDocument(COLLECTIONS.NOTES, noteData);
    console.log("Note created with ID:", id);
    return id;
  } catch (error) {
    console.error("Error creating note:", error);
    throw error;
  }
}

// Update note
export async function updateNote(
  noteId: string,
  data: Partial<Omit<Note, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDocument(COLLECTIONS.NOTES, noteId, data);
}

// Delete note
export async function deleteNote(noteId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.NOTES, noteId);
}

// Toggle pin
export async function toggleNotePin(noteId: string, isPinned: boolean): Promise<void> {
  await updateDocument(COLLECTIONS.NOTES, noteId, { isPinned });
}

// Add checkpoint to note
export async function addCheckpoint(
  noteId: string,
  text: string
): Promise<void> {
  const note = await getNoteById(noteId);
  if (!note) return;

  const newCheckpoint: NoteCheckpoint = {
    id: `checkpoint-${Date.now()}`,
    text,
    isChecked: false,
  };

  await updateDocument(COLLECTIONS.NOTES, noteId, {
    checkpoints: [...note.checkpoints, newCheckpoint],
  });
}

// Toggle checkpoint
export async function toggleCheckpoint(
  noteId: string,
  checkpointId: string,
  isChecked: boolean
): Promise<void> {
  const note = await getNoteById(noteId);
  if (!note) return;

  const updatedCheckpoints = note.checkpoints.map((cp) =>
    cp.id === checkpointId ? { ...cp, isChecked } : cp
  );

  await updateDocument(COLLECTIONS.NOTES, noteId, {
    checkpoints: updatedCheckpoints,
  });
}

// Remove checkpoint
export async function removeCheckpoint(
  noteId: string,
  checkpointId: string
): Promise<void> {
  const note = await getNoteById(noteId);
  if (!note) return;

  const updatedCheckpoints = note.checkpoints.filter(
    (cp) => cp.id !== checkpointId
  );

  await updateDocument(COLLECTIONS.NOTES, noteId, {
    checkpoints: updatedCheckpoints,
  });
}

// Search notes
export async function searchNotes(searchTerm: string): Promise<Note[]> {
  // Note: Firestore doesn't support full-text search natively
  // For production, consider using Algolia or similar
  const allNotes = await getAllNotes();
  const term = searchTerm.toLowerCase();

  return allNotes.filter(
    (note) =>
      note.title.toLowerCase().includes(term) ||
      note.content.toLowerCase().includes(term)
  );
}
