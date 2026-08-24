import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyAuthHeader, handlePresignAction, type PresignRequestBody } from "./_r2PresignCore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../frontend/dist");
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());

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
