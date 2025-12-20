import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./useFirestore";
import type { DocumentType } from "@/types";

// Upload document with file to R2
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
      const { uploadFileToR2 } = await import("@/services/r2Service");
      const { createDocumentRecord } = await import("@/services/documentService");

      // Upload file to R2
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

// Delete document and its file from R2
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, fileUrl }: { documentId: string; fileUrl?: string }) => {
      const { deleteDocumentRecord } = await import("@/services/documentService");

      // Delete file from R2 if exists
      if (fileUrl) {
        try {
          const { extractFileKeyFromUrl, deleteFileFromR2 } = await import("@/services/r2Service");
          const fileKey = extractFileKeyFromUrl(fileUrl);
          if (fileKey) {
            await deleteFileFromR2(fileKey);
          }
        } catch (error) {
          console.error("Failed to delete file from R2:", error);
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
      const { uploadFileToR2, extractFileKeyFromUrl, deleteFileFromR2 } = await import("@/services/r2Service");
      const { attachFileToDocument } = await import("@/services/documentService");

      // Delete old file if exists
      if (oldFileUrl) {
        try {
          const oldFileKey = extractFileKeyFromUrl(oldFileUrl);
          if (oldFileKey) {
            await deleteFileFromR2(oldFileKey);
          }
        } catch (error) {
          console.error("Failed to delete old file from R2:", error);
        }
      }

      // Upload new file
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
