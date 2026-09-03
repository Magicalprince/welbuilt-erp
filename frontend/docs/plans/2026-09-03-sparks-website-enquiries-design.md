# Sparks AI Website Enquiries Integration — Design

## Context

`F:\WELBUILT\sparks` (sparksai.in marketing site) moved its lead-capture form off Supabase to a plain Postgres service on Dokploy on 2026-09-02 (commit `e0bdf14`). The schema (`db/schema.sql`) explicitly anticipates this integration: *"Workflow state for whoever is working the lead... moved by hand (and, later, by the Welbuilt ERP's Leads section)."*

Confirmed live (2026-09-03) via a temporary diagnostic route, then reverted: `welbuilt-erp`'s Dokploy application can reach `sparks-leads-db-lq4x8m-gy4qiq:5432` directly over Dokploy's internal Docker network — same network both apps already sit on with no custom `networkIds`. No new infrastructure needed.

## Source data

Postgres database `leads` (service `sparks-leads-db-lq4x8m-gy4qiq`, Dokploy project "Sparks AI Websites"), table `public.leads`:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| created_at | timestamptz | |
| name | text NOT NULL | |
| email | text NOT NULL | |
| phone | text | nullable — 5 pre-migration rows have none; required on the form since 2026-09-02 |
| topic | text | only set by /contact's ContactForm; CTASection never sets it |
| project_description | text NOT NULL | |
| source_page | text | e.g. `/contact`, `/` |
| status | text NOT NULL DEFAULT 'new' | free text, never written by the site itself — this is the field the ERP is meant to own |
| user_agent | text | |

No port exposed publicly; no RLS (network boundary is the access control, per the schema's own comment). Currently 5 rows (pre-migration Supabase data, all with NULL phone).

## Architecture

**Read/write path**: new routes on `welbuilt-erp`'s existing Express server (`server/index.ts`), not a Vercel function — Vercel serverless functions run outside Dokploy's Docker network and cannot reach a DB with no public port. This mirrors the existing `/api/r2-presign` and `/api/storage/*` pattern exactly: Firebase ID token auth via `verifyAuthHeader`, credentials only in Dokploy's server-side env (never shipped to the browser).

- `GET /api/sparks-enquiries` — list all rows, newest first. Auth required.
- `PATCH /api/sparks-enquiries/:id/status` — update the `status` column (e.g. `new` → `contacted` → `converted`/`archived`). Auth required. This is the ERP claiming the "moved by hand... by the Welbuilt ERP's Leads section" role the schema comment describes.

New `server/_sparksLeadsCore.ts` (framework-agnostic core, same shape as `_storageCore.ts`/`_r2PresignCore.ts`) holds the `pg` Pool and queries. Lazily constructed, same reasoning as `sparks`'s own `src/lib/db.ts`: importing the module at build/module-load time must not require the env var to be present, and a bad/missing credential must not crash the whole server (static file serving + all other routes must keep working).

New env var on `welbuilt-erp`'s Dokploy config: `SPARKS_LEADS_DATABASE_URL` (kept distinct from a hypothetical future `DATABASE_URL` on this app, and named for what it is — this is a read mostly, occasional-write integration into someone else's database, not this app's own data store).

## Frontend

New `frontend/src/services/sparksEnquiriesService.ts` — thin fetch wrapper calling the two routes above, matching `serverStorageService.ts`'s auth-header pattern.

New tab on `SparksLeadsTab.tsx` (or a toggle within it — implementation will decide the cleanest UI once building) labeled **"Website Enquiries"**, next to the existing lead list:
- Read-only table: name, email, phone (— if null), project description (truncated, full on click), source page, submitted date, status badge.
- Per-row **"Convert to Lead"** button — opens the existing `NewLeadModal` pre-filled from the enquiry (leadName, email, contactNumber, description → description, source forced to `WEBSITE`), founder reviews/edits and submits same as any manual lead. This mirrors the established "founder adds the real record manually via the existing form, never a special-cased auto-create path" pattern from the original Leads CRM design (see `leads_crm` memory) — converting sets the enquiry's Postgres `status` to `converted` via the PATCH route, but does NOT auto-create the SparksLead itself.
- Manual status controls (mark contacted / archived) via the PATCH route, for enquiries the founder handles without converting (spam, duplicate, already a client calling in some other way).

No new Firestore collection. No automatic sync/polling — the tab fetches on open/refresh, same as every other list in this app (React Query, no realtime subscription needed for a low-volume marketing-site form).

## Security notes

- `sparks-leads-db` credentials are a new secret this app now holds — server-side env only, never in `VITE_`-prefixed vars, never in frontend code. Same discipline as the R2/Firebase Admin credentials already there.
- The enquiries contain real customer PII (name, email, phone, free-text project description) submitted by the public with no expectation it would be viewed by a second internal tool — access must stay behind the existing founder-only gating the rest of `/leads` already has (no new RBAC needed, matches memory's note that `/leads` has no special role check beyond excluding `INTERN_MANAGER`).
- The PATCH route only ever touches the `status` column — no delete, no update to name/email/phone/description. The enquiry data itself is immutable from the ERP's side; only workflow state moves.

## Out of scope for this pass

- No changes to the `sparks` repo itself — it already does everything needed (schema, validation, insert). This is purely additive on the `welbuilt-erp` side.
- No auto-conversion, no deduplication against existing Clients (the existing `findMatchingClient` check already happens naturally once a founder clicks "Convert to Lead" → the existing Convert-to-Client flow on the resulting SparksLead).
- No pagination — 5 rows today, and a marketing site's contact form is not going to produce data volume that needs it soon; add later if it ever does.
