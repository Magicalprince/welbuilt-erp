import { Pool } from "pg";

// Reads/updates the `leads` table in sparks-leads-db — the Postgres service
// backing sparksai.in's contact form (see F:\WELBUILT\sparks, commit e0bdf14
// "Move lead capture to Dokploy Postgres"). That schema's own comment
// anticipates this: "Workflow state... moved by hand (and, later, by the
// Welbuilt ERP's Leads section)." This module is that later part.
//
// Both apps sit on Dokploy's default Docker network with no custom
// networkIds, so this reaches sparks-leads-db-lq4x8m-gy4qiq:5432 directly —
// confirmed live 2026-09-03. No port exposed publicly; SPARKS_LEADS_DATABASE_URL
// is a second database this app talks to, distinct from Firestore.

// Lazily constructed — a missing/invalid credential must only fail the
// enquiries routes that need it, not crash the whole server at import time
// (this module is imported by the same Express app serving static files and
// every other route).
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SPARKS_LEADS_DATABASE_URL;
    if (!connectionString) {
      throw new Error("SPARKS_LEADS_DATABASE_URL is not configured");
    }
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.SPARKS_LEADS_DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      console.error("[sparks-leads-db] idle client error:", err.message);
    });
  }
  return pool;
}

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

interface EnquiryRow {
  id: string;
  created_at: Date;
  name: string;
  email: string;
  phone: string | null;
  topic: string | null;
  project_description: string;
  source_page: string | null;
  status: string;
  user_agent: string | null;
}

function toEnquiry(row: EnquiryRow): SparksEnquiry {
  return {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    name: row.name,
    email: row.email,
    phone: row.phone,
    topic: row.topic,
    projectDescription: row.project_description,
    sourcePage: row.source_page,
    status: row.status,
    userAgent: row.user_agent,
  };
}

export async function listSparksEnquiries(): Promise<SparksEnquiry[]> {
  const result = await getPool().query<EnquiryRow>(
    `SELECT id, created_at, name, email, phone, topic, project_description, source_page, status, user_agent
     FROM public.leads
     ORDER BY created_at DESC`
  );
  return result.rows.map(toEnquiry);
}

// Only the workflow-state column is writable from here. Name/email/phone/
// project_description/source_page are the visitor's own submission and stay
// immutable from this side — this route claims the "status" ownership the
// schema comment describes, nothing more.
export async function updateSparksEnquiryStatus(id: string, status: string): Promise<SparksEnquiry | null> {
  const result = await getPool().query<EnquiryRow>(
    `UPDATE public.leads
     SET status = $2
     WHERE id = $1
     RETURNING id, created_at, name, email, phone, topic, project_description, source_page, status, user_agent`,
    [id, status]
  );
  return result.rows[0] ? toEnquiry(result.rows[0]) : null;
}
