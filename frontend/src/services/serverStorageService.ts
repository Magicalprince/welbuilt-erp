import { auth } from "@/config/firebase";

// Server-side document storage — files live on the Dokploy-managed volume
// mounted into the Express server (server/index.ts), not Cloudflare R2.
// This file is a drop-in replacement for r2Service.ts: every exported
// function keeps the same name/signature/return shape so callers only need
// to change their import, not their call sites. New uploads should import
// from here; r2Service.ts is left untouched so existing R2-stored documents
// keep working (see docs/plans/2026-08-24-billing-and-storage-design.md —
// migration of already-stored documents is a deliberate separate follow-up).

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

async function parseErrorBody(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body.error || `Request failed: ${response.status}`;
}

// Upload a new file — server generates the key.
export async function uploadFileToR2(
  file: File,
  folder: string = "documents"
): Promise<{ fileUrl: string; fileKey: string; fileSize: number; mimeType: string }> {
  const headers = await authHeaders();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }

  return response.json();
}

// Upload/overwrite at a specific key (for updates that must keep the same URL).
export async function uploadFileWithKey(
  file: File,
  fileKey: string
): Promise<{ fileUrl: string; fileSize: number; mimeType: string }> {
  const headers = await authHeaders();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileKey", fileKey);

  const response = await fetch("/api/storage/upload-with-key", {
    method: "PUT",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }

  return response.json();
}

// Delete a stored file.
export async function deleteFileFromR2(fileKey: string): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(`/api/storage/${fileKey}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }
}

// Get a signed, time-limited URL for downloading — usable directly in an
// <a href>/new-tab without an Authorization header, same as R2's presigned
// GET URLs (DocumentsPage.tsx already depends on this contract).
export async function getSignedDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
  const headers = await authHeaders();
  const response = await fetch("/api/storage/presign-download", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fileKey, expiresIn }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }
  const { url } = await response.json();
  return url;
}

// Not applicable to server storage — there is no separate "upload URL" to
// hand the browser, since uploads always go through /api/storage/upload
// directly. Kept for interface parity with r2Service.ts; throws if called,
// so a caller relying on presigned-PUT-to-storage semantics fails loudly
// instead of silently no-op'ing.
export async function getSignedUploadUrl(): Promise<string> {
  throw new Error(
    "getSignedUploadUrl is not supported by server-side storage — use uploadFileToR2/uploadFileWithKey instead"
  );
}

// Non-secret — the origin this server's storage is reachable at. Only used
// to recognize URLs already pointing at server storage (as opposed to R2).
const STORAGE_PATH_MARKER = "/storage/";

export function extractFileKeyFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;
  const idx = fileUrl.indexOf(STORAGE_PATH_MARKER);
  if (idx === -1) return null;
  const afterMarker = fileUrl.slice(idx + STORAGE_PATH_MARKER.length);
  // Strip any query string (signed download URLs carry ?expires=&token=).
  return afterMarker.split("?")[0] || null;
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

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

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

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

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit` };
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return { valid: false, error: "File type not allowed" };
  }
  return { valid: true };
}
