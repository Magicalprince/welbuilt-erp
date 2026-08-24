import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Server-side document storage backed by a local (Dokploy-managed volume)
// directory instead of Cloudflare R2. Mirrors _r2PresignCore.ts's shape —
// framework-agnostic core, auth handled by the caller — but there is no
// presigning step: this server IS the storage, so uploads/downloads/deletes
// happen directly against the mounted volume.

// Root of the storage volume. In production this is the Dokploy-managed
// volume mount point; falls back to a local ./data/documents dir so the
// server also runs (and can be tested) outside Docker. Always normalized
// through path.resolve() — resolveSafePath() below compares against this
// with path.resolve() too, and an unresolved env-var path (relative,
// trailing slash, POSIX-style on Windows, etc.) would never string-match
// its own resolved form, rejecting every legitimate key as a traversal.
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || path.resolve(process.cwd(), "data", "documents"));

function generateFileKey(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${folder}/${timestamp}-${random}-${sanitizedFileName}`;
}

// A fileKey is untrusted input (comes from the client on delete/download
// calls). Resolve it against STORAGE_ROOT and verify the result is still
// inside STORAGE_ROOT before touching the filesystem — this is what
// actually blocks "../../etc/passwd"-style traversal, not the regex checks
// on the key format alone.
function resolveSafePath(fileKey: string): string {
  const normalized = fileKey.replace(/^\/+/, "");
  const resolved = path.resolve(STORAGE_ROOT, normalized);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep) ? STORAGE_ROOT : STORAGE_ROOT + path.sep;
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(rootWithSep)) {
    throw new Error("INVALID_FILE_KEY");
  }
  return resolved;
}

export async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

export interface SaveFileResult {
  fileKey: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

// PUBLIC_BASE_URL is the externally-reachable origin for this server
// (e.g. https://erp.welbuiltai.in) — needed to build a fully-qualified
// fileUrl the way R2's public URL worked. Falls back to a relative path,
// which still works since the same Express server also serves the SPA
// and can serve /storage/* from the same origin.
function buildFileUrl(fileKey: string): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/storage/${fileKey}` : `/storage/${fileKey}`;
}

export async function saveUploadedFile(
  folder: string,
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<SaveFileResult> {
  const fileKey = generateFileKey(folder || "documents", originalName);
  const fullPath = resolveSafePath(fileKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, new Uint8Array(buffer));
  return {
    fileKey,
    fileUrl: buildFileUrl(fileKey),
    fileSize: buffer.length,
    mimeType,
  };
}

// Save under a caller-specified key (mirrors R2's "uploadFileWithKey", used
// when overwriting/replacing a document that must keep its existing URL).
export async function saveFileWithKey(
  fileKey: string,
  mimeType: string,
  buffer: Buffer,
): Promise<SaveFileResult> {
  const fullPath = resolveSafePath(fileKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, new Uint8Array(buffer));
  return {
    fileKey,
    fileUrl: buildFileUrl(fileKey),
    fileSize: buffer.length,
    mimeType,
  };
}

export async function readStoredFile(fileKey: string): Promise<Buffer> {
  const fullPath = resolveSafePath(fileKey);
  return fs.readFile(fullPath);
}

export async function deleteStoredFile(fileKey: string): Promise<void> {
  const fullPath = resolveSafePath(fileKey);
  await fs.rm(fullPath, { force: true });
}

export async function fileExists(fileKey: string): Promise<boolean> {
  try {
    const fullPath = resolveSafePath(fileKey);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

// ── Signed, time-limited download links ──────────────────────────────────
// R2's presigned GET URLs work in a plain <a href>/new-tab without an
// Authorization header, and DocumentsPage.tsx's download flow already
// depends on that (calls getSignedDownloadUrl(fileKey) then opens the URL
// directly, no header attached). A hard-auth-gated /storage/:fileKey route
// would break that flow, so instead sign the fileKey+expiry with an HMAC
// secret only this server holds — same trust model as a presigned URL,
// just self-issued instead of issued by S3.
function getSigningSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET;
  if (!secret) {
    throw new Error("STORAGE_SIGNING_SECRET is not configured");
  }
  return secret;
}

function sign(fileKey: string, expires: number): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${fileKey}:${expires}`)
    .digest("hex");
}

export function buildSignedDownloadUrl(fileKey: string, expiresInSeconds: number = 3600): string {
  const expires = Date.now() + expiresInSeconds * 1000;
  const token = sign(fileKey, expires);
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? "";
  return `${base}/storage/${fileKey}?expires=${expires}&token=${token}`;
}

export function verifyDownloadToken(fileKey: string, expires: string | undefined, token: string | undefined): boolean {
  if (!expires || !token) return false;
  const expiresNum = Number(expires);
  if (!Number.isFinite(expiresNum) || Date.now() > expiresNum) return false;
  const expected = sign(fileKey, expiresNum);
  // Constant-time comparison — avoids leaking the valid token via timing.
  const expectedBuf = new Uint8Array(Buffer.from(expected));
  const actualBuf = new Uint8Array(Buffer.from(token));
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
