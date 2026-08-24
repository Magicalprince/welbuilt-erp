import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Framework-agnostic core: used by both the Vercel serverless handler
// (api/r2-presign.ts) and the Express server (server/index.ts, for the
// Docker/Dokploy deploy). Keeping the logic here means both entrypoints
// stay in sync automatically instead of drifting.

// Lazily constructed on first use — a missing/invalid credential should only
// fail the presign request that needed it, not crash the whole process at
// import time (this module is imported by the Express server alongside
// static-file serving, which must keep working even if R2/Firebase env vars
// are misconfigured).
let s3Client: S3Client | undefined;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return s3Client;
}

function ensureFirebaseAdminInitialized(): void {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Env vars store literal "\n" for newlines in multi-line values.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
}

function generateFileKey(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${folder}/${timestamp}-${sanitizedFileName}`;
}

export async function verifyAuthHeader(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED");
  }
  ensureFirebaseAdminInitialized();
  const idToken = authHeader.slice("Bearer ".length);
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

export interface PresignRequestBody {
  action: "presignUpload" | "presignUploadWithKey" | "presignDownload" | "delete";
  folder?: string;
  fileName?: string;
  fileKey?: string;
  contentType?: string;
  expiresIn?: number;
}

export type PresignResult =
  | { status: 200; body: { url: string; fileKey: string } }
  | { status: 200; body: { url: string } }
  | { status: 200; body: { success: true } }
  | { status: 400; body: { error: string } };

// Executes the requested R2 action. Caller is responsible for auth
// (verifyAuthHeader) and HTTP method checks before calling this.
export async function handlePresignAction(body: PresignRequestBody): Promise<PresignResult> {
  const bucket = process.env.R2_BUCKET_NAME!;

  switch (body.action) {
    case "presignUpload": {
      const { folder = "documents", fileName, contentType } = body;
      if (!fileName || !contentType) {
        return { status: 400, body: { error: "fileName and contentType are required" } };
      }
      const fileKey = generateFileKey(folder, fileName);
      const command = new PutObjectCommand({ Bucket: bucket, Key: fileKey, ContentType: contentType });
      const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
      return { status: 200, body: { url, fileKey } };
    }

    case "presignUploadWithKey": {
      const { fileKey, contentType, expiresIn = 3600 } = body;
      if (!fileKey || !contentType) {
        return { status: 400, body: { error: "fileKey and contentType are required" } };
      }
      const command = new PutObjectCommand({ Bucket: bucket, Key: fileKey, ContentType: contentType });
      const url = await getSignedUrl(getS3Client(), command, { expiresIn });
      return { status: 200, body: { url, fileKey } };
    }

    case "presignDownload": {
      const { fileKey, expiresIn = 3600 } = body;
      if (!fileKey) {
        return { status: 400, body: { error: "fileKey is required" } };
      }
      const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
      const url = await getSignedUrl(getS3Client(), command, { expiresIn });
      return { status: 200, body: { url } };
    }

    case "delete": {
      const { fileKey } = body;
      if (!fileKey) {
        return { status: 400, body: { error: "fileKey is required" } };
      }
      await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: fileKey }));
      return { status: 200, body: { success: true } };
    }

    default:
      return { status: 400, body: { error: "Unknown action" } };
  }
}
