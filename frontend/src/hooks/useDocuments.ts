import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./useFirestore";
import type { DocumentType } from "@/types";

// New uploads go to server-side storage (Dokploy volume) instead of R2 —
// see docs/plans/2026-08-24-billing-and-storage-design.md. Existing R2 URLs
// are still recognized so delete/replace on old documents keeps working;
// r2Service.ts is untouched. deleteExistingFile below picks the right
// backend per-URL rather than assuming one.
async function deleteExistingFile(fileUrl: string): Promise<void> {
  const r2 = await import("@/services/r2Service");
  const r2Key = r2.extractFileKeyFromUrl(fileUrl);
  if (r2Key) {
    await r2.deleteFileFromR2(r2Key);
    return;
  }
  const serverStorage = await import("@/services/serverStorageService");
  const serverKey = serverStorage.extractFileKeyFromUrl(fileUrl);
  if (serverKey) {
    await serverStorage.deleteFileFromR2(serverKey);
  }
}

// Get a signed download URL for a fileUrl regardless of which backend it
// was stored on — old documents are still on R2, new ones on server
// storage, and a fileUrl alone doesn't say which without checking.
export async function getSignedDownloadUrlForAnyBackend(fileUrl: string): Promise<string | null> {
  const r2 = await import("@/services/r2Service");
  const r2Key = r2.extractFileKeyFromUrl(fileUrl);
  if (r2Key) {
    return r2.getSignedDownloadUrl(r2Key);
  }
  const serverStorage = await import("@/services/serverStorageService");
  const serverKey = serverStorage.extractFileKeyFromUrl(fileUrl);
  if (serverKey) {
    return serverStorage.getSignedDownloadUrl(serverKey);
  }
  return null;
}

// Upload document with file to server-side storage
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      metadata,
    }: {
      file: File;
      metadata: {
        name: string;
        type: DocumentType;
        uploadedBy: string;
        projectId?: string;
        clientId?: string;
        invoiceId?: string;
        description?: string;
        tags?: string[];
      };
    }) => {
      const { uploadFileToR2 } = await import("@/services/serverStorageService");
      const { createDocumentRecord } = await import("@/services/documentService");

      const { fileUrl, fileSize, mimeType } = await uploadFileToR2(file, "documents");

      // Create document record in Firestore
      return createDocumentRecord({
        ...metadata,
        fileUrl,
        fileSize,
        mimeType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

// Update document metadata
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      data,
    }: {
      documentId: string;
      data: Partial<{
        name: string;
        type: DocumentType;
        description: string;
        tags: string[];
        projectId: string;
        clientId: string;
        invoiceId: string;
      }>;
    }) => {
      const { updateDocumentRecord } = await import("@/services/documentService");
      return updateDocumentRecord(documentId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

// Delete document and its file (from whichever backend it's actually stored on)
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, fileUrl }: { documentId: string; fileUrl?: string }) => {
      const { deleteDocumentRecord } = await import("@/services/documentService");

      if (fileUrl) {
        try {
          await deleteExistingFile(fileUrl);
        } catch (error) {
          console.error("Failed to delete stored file:", error);
        }
      }

      // Delete document record from Firestore
      return deleteDocumentRecord(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

// Re-upload file for existing document
export function useReplaceDocumentFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      file,
      oldFileUrl,
    }: {
      documentId: string;
      file: File;
      oldFileUrl?: string;
    }) => {
      const { uploadFileToR2 } = await import("@/services/serverStorageService");
      const { attachFileToDocument } = await import("@/services/documentService");

      // Delete old file if exists (may be on either backend)
      if (oldFileUrl) {
        try {
          await deleteExistingFile(oldFileUrl);
        } catch (error) {
          console.error("Failed to delete old stored file:", error);
        }
      }

      // Upload new file to server storage
      const { fileUrl, fileSize, mimeType } = await uploadFileToR2(file, "documents");

      // Update document record
      await attachFileToDocument(documentId, { fileUrl, fileSize, mimeType });

      return { fileUrl, fileSize, mimeType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}
