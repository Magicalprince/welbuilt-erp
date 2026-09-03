import { auth } from "@/config/firebase";

// Reads/updates sparksai.in's contact-form submissions, stored in a separate
// Postgres database (sparks-leads-db on Dokploy) that welbuilt-erp's own
// Express server reaches over the internal Docker network — see
// server/_sparksLeadsCore.ts and
// docs/plans/2026-09-03-sparks-website-enquiries-design.md. Not Firestore;
// these are raw form submissions from the public site, distinct from
// SparksLead (the worked-lead pipeline record created once a founder
// reviews one via "Convert to Lead").

export interface SparksEnquiry {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string | null;
  projectDescription: string;
  sourcePage: string | null;
  status: string;
  userAgent: string | null;
}

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

export async function getSparksEnquiries(): Promise<SparksEnquiry[]> {
  const headers = await authHeaders();
  const response = await fetch("/api/sparks-enquiries", { headers });
  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }
  const { enquiries } = await response.json();
  return enquiries;
}

export async function updateSparksEnquiryStatus(id: string, status: string): Promise<SparksEnquiry> {
  const headers = await authHeaders();
  const response = await fetch(`/api/sparks-enquiries/${id}/status`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorBody(response));
  }
  const { enquiry } = await response.json();
  return enquiry;
}
