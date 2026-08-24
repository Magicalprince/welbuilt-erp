import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAuthHeader, handlePresignAction, type PresignRequestBody } from "../server/_r2PresignCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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
}
