import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 Configuration from environment variables
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_ENDPOINT = import.meta.env.VITE_R2_ENDPOINT;
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

// Initialize S3 Client for R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Generate a unique file key with folder structure
function generateFileKey(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${folder}/${timestamp}-${sanitizedFileName}`;
}

// Upload file to R2 using presigned URL (browser-compatible)
export async function uploadFileToR2(
  file: File,
  folder: string = "documents"
): Promise<{ fileUrl: string; fileKey: string; fileSize: number; mimeType: string }> {
  const fileKey = generateFileKey(folder, file.name);

  // Generate a presigned URL for upload
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: file.type,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Upload using the presigned URL with fetch (avoids CORS issues)
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  // Generate the file URL
  const fileUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${fileKey}`
    : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;

  return {
    fileUrl,
    fileKey,
    fileSize: file.size,
    mimeType: file.type,
  };
}

// Upload file with specific key (for updates)
export async function uploadFileWithKey(
  file: File,
  fileKey: string
): Promise<{ fileUrl: string; fileSize: number; mimeType: string }> {
  // Generate a presigned URL for upload
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: file.type,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Upload using the presigned URL with fetch
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const fileUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${fileKey}`
    : `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`;

  return {
    fileUrl,
    fileSize: file.size,
    mimeType: file.type,
  };
}

// Delete file from R2
export async function deleteFileFromR2(fileKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
  });

  await s3Client.send(command);
}

// Get a signed URL for downloading (for private buckets)
export async function getSignedDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Get a signed URL for uploading (for direct browser uploads)
export async function getSignedUploadUrl(
  fileKey: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Extract file key from URL
export function extractFileKeyFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // Handle R2 public URL format
  if (R2_PUBLIC_URL && fileUrl.startsWith(R2_PUBLIC_URL)) {
    return fileUrl.replace(`${R2_PUBLIC_URL}/`, "");
  }

  // Handle endpoint URL format
  if (fileUrl.includes(R2_BUCKET_NAME)) {
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
