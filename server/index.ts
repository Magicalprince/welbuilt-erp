import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAuthHeader, handlePresignAction, type PresignRequestBody } from "./_r2PresignCore";
import {
  ensureStorageRoot,
  saveUploadedFile,
  saveFileWithKey,
  readStoredFile,
  deleteStoredFile,
  buildSignedDownloadUrl,
  verifyDownloadToken,
} from "./_storageCore";
import { listSparksEnquiries, updateSparksEnquiryStatus } from "./_sparksLeadsCore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../frontend/dist");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — matches r2Service.ts's MAX_FILE_SIZE
});

await ensureStorageRoot();

app.post("/api/r2-presign", async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await handlePresignAction((req.body ?? {}) as PresignRequestBody);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("R2 presign handler error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Server-side document storage (Dokploy volume, replaces R2 for new uploads) ──

app.post("/api/storage/upload", upload.single("file"), async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  try {
    const folder = typeof req.body?.folder === "string" ? req.body.folder : "documents";
    const result = await saveUploadedFile(folder, req.file.originalname, req.file.mimetype, req.file.buffer);
    res.status(200).json(result);
  } catch (error) {
    console.error("Storage upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload/overwrite at a caller-specified key — mirrors R2's uploadFileWithKey.
app.put("/api/storage/upload-with-key", upload.single("file"), async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const fileKey = typeof req.body?.fileKey === "string" ? req.body.fileKey : undefined;
  if (!req.file || !fileKey) {
    res.status(400).json({ error: "file and fileKey are required" });
    return;
  }
  try {
    const result = await saveFileWithKey(fileKey, req.file.mimetype, req.file.buffer);
    res.status(200).json(result);
  } catch (error) {
    console.error("Storage upload-with-key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/storage/:fileKey(*)", async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await deleteStoredFile(req.params.fileKey);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Storage delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Issue a short-lived signed download URL for a fileKey — mirrors R2's
// presignDownload. Requires auth to REQUEST the link; the link itself then
// works in a plain <a href>/new-tab (no Authorization header available
// there), matching how DocumentsPage.tsx already consumes R2 download URLs.
app.post("/api/storage/presign-download", async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const fileKey = typeof req.body?.fileKey === "string" ? req.body.fileKey : undefined;
  const expiresIn = typeof req.body?.expiresIn === "number" ? req.body.expiresIn : 3600;
  if (!fileKey) {
    res.status(400).json({ error: "fileKey is required" });
    return;
  }
  try {
    const url = buildSignedDownloadUrl(fileKey, expiresIn);
    res.status(200).json({ url });
  } catch (error) {
    console.error("Storage presign-download error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Actual file bytes — gated by the signed token from presign-download above,
// not a bearer header (this URL is meant to be opened directly by the
// browser, same trust model as an R2 presigned GET URL).
app.get("/storage/:fileKey(*)", async (req, res) => {
  const fileKey = req.params.fileKey;
  const expires = typeof req.query.expires === "string" ? req.query.expires : undefined;
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  if (!verifyDownloadToken(fileKey, expires, token)) {
    res.status(403).json({ error: "Invalid or expired link" });
    return;
  }
  try {
    const buffer = await readStoredFile(fileKey);
    res.status(200).send(buffer);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// ── Sparks AI website enquiries (read/status-update into sparks-leads-db) ──

app.get("/api/sparks-enquiries", async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const enquiries = await listSparksEnquiries();
    res.status(200).json({ enquiries });
  } catch (error) {
    console.error("Sparks enquiries list error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/api/sparks-enquiries/:id/status", async (req, res) => {
  try {
    await verifyAuthHeader(req.headers.authorization);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  try {
    const updated = await updateSparksEnquiryStatus(req.params.id, status);
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({ enquiry: updated });
  } catch (error) {
    console.error("Sparks enquiry status update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// Serve the built Vite frontend as static files.
app.use(express.static(DIST_DIR));

// SPA fallback: any other GET request returns index.html so client-side
// routing (React Router) works on a hard refresh/direct link.
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`welbuilt-erp server listening on port ${PORT}`);
});
