import { auth } from "@/config/firebase";

// All R2 signing now happens server-side (api/r2-presign.ts) — the R2
// secret access key is never sent to the browser. This file only talks to
// that endpoint, authenticated with the current user's Firebase ID token.

async function callPresignEndpoint<T>(body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }
  const idToken = await user.getIdToken();

  const response = await fetch("/api/r2-presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Upload file to R2 using a presigned URL obtained from the server
export async function uploadFileToR2(
  file: File,
  folder: string = "documents"
): Promise<{ fileUrl: string; fileKey: string; fileSize: number; mimeType: string }> {
  const { url: presignedUrl, fileKey } = await callPresignEndpoint<{ url: string; fileKey: string }>({
    action: "presignUpload",
    folder,
    fileName: file.name,
    contentType: file.type,
  });

  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    mode: "cors",
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const fileUrl = buildPublicUrl(fileKey);

  return {
    fileUrl,
    fileKey,
    fileSize: file.size,
    mimeType: file.type,
  };
}

// Upload file with a specific key (for updates)
export async function uploadFileWithKey(
  file: File,
  fileKey: string
): Promise<{ fileUrl: string; fileSize: number; mimeType: string }> {
  const { url: presignedUrl } = await callPresignEndpoint<{ url: string; fileKey: string }>({
    action: "presignUploadWithKey",
    fileKey,
    contentType: file.type,
  });

  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    mode: "cors",
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  return {
    fileUrl: buildPublicUrl(fileKey),
    fileSize: file.size,
    mimeType: file.type,
  };
}

// Delete file from R2
export async function deleteFileFromR2(fileKey: string): Promise<void> {
  await callPresignEndpoint<{ success: boolean }>({
    action: "delete",
    fileKey,
  });
}

// Get a signed URL for downloading (for private buckets)
export async function getSignedDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
  const { url } = await callPresignEndpoint<{ url: string }>({
    action: "presignDownload",
    fileKey,
    expiresIn,
  });
  return url;
}

// Get a signed URL for uploading (for direct browser uploads)
export async function getSignedUploadUrl(
  fileKey: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const { url } = await callPresignEndpoint<{ url: string; fileKey: string }>({
    action: "presignUploadWithKey",
    fileKey,
    contentType,
    expiresIn,
  });
  return url;
}

// Non-secret — just the bucket hostname/name, safe to ship to the browser.
// Kept as VITE_ vars since existing stored fileUrls already use this format.
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;
const R2_ENDPOINT = import.meta.env.VITE_R2_ENDPOINT;
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;

function buildPublicUrl(fileKey: string): string {
  return R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${fileKey}`
    : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;
}

// Extract file key from URL
export function extractFileKeyFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // Handle R2 public URL format
  if (R2_PUBLIC_URL && fileUrl.startsWith(R2_PUBLIC_URL)) {
    return fileUrl.replace(`${R2_PUBLIC_URL}/`, "");
  }

  // Handle endpoint URL format
  if (R2_BUCKET_NAME && fileUrl.includes(R2_BUCKET_NAME)) {
    const parts = fileUrl.split(`${R2_BUCKET_NAME}/`);
    return parts[1] || null;
  }

  return null;
}

// Get file extension from filename
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

// Check if file type is allowed
export function isAllowedFileType(file: File, allowedTypes: string[]): boolean {
  const extension = getFileExtension(file.name);
  const mimeType = file.type;

  return allowedTypes.some(
    (type) =>
      type === extension ||
      type === mimeType ||
      mimeType.startsWith(type.replace("/*", "/"))
  );
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Allowed document types for the ERP
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "text/plain",
  "text/csv",
];

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Validate file before upload
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit` };
  }

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return { valid: false, error: "File type not allowed" };
  }

  return { valid: true };
}
