# Billing Documents & Server-Side Storage — Design

Self-brainstormed and self-answered per explicit user instruction (2026-08-24): user is unavailable for the duration of this build, so every question below is resolved from project memory, existing code conventions, and standard invoicing/GST practice rather than asked. Revisit any ⚠️ marked decision when the user returns.

## Scope (from user's request, verbatim intent)

1. **Fix the Firebase 400** — DONE. Root cause: `activityLogService.ts` and 3 functions in `communicationService.ts` used `where(X) + orderBy(createdAt)` with `X !== "createdAt"` and no composite index exists (no `firestore.indexes.json` in repo at all). Also pre-emptively fixed 9 dormant compound queries in `useRealtimeFirestore.ts` that would hit the same wall the moment they're wired up (which is likely, given this build touches invoices/clients). Fix pattern: single `where()` only, sort client-side — matches the pattern the Leads CRM already established (`sparkedLeadService.ts`, `financeService.ts`).

2. **Professional invoice generator** — branded PDF, issued as **Sparks AI** (software-solutions brand) with **WelBuilt AI Solutions** credited in the footer, modern 2026 design, GST-customizable.

3. **Server-side document storage** — migrate from Cloudflare R2 to the Dokploy-hosted volume (already decided: Dokploy-managed volume + scheduled backups).

4. **Quotations tracking page** — a real page mapping every quotation to client/project (prompting for missing client/project details inline), distinct in *purpose* from Invoice: Quotation = pre-sale estimate; Invoice = the actual bill sent to a paying client, used for IT filing, GST-customizable (on/off + rate).

## What already exists (confirmed via full codebase survey, not assumed)

- **Invoice** and **Quotation** types are already fully modeled in `types/index.ts`, including `GSTType = "CGST_SGST" | "IGST" | "NONE"` with per-type CGST/SGST/IGST percent+amount fields — the "GST customizable, on/off, %" requirement is **already data-modeled**, just needs UI/PDF surfacing.
- `invoiceService.ts` and `quotationService.ts` — full CRUD, number generators (`INV-001`, `QUO-001`), payment tracking, `convertQuotationToInvoice()`.
- `InvoicesPage.tsx` / `InvoiceFormPage.tsx` / `InvoiceDetailPage.tsx` — list/create/detail UI exists. **"Download PDF" button in `InvoiceDetailPage.tsx` is a dead stub with no onClick.**
- `QuotationsPage.tsx` — single 838-line file, list + create/detail as inline modals. No PDF export anywhere.
- `CompanySettings` type + `settingsService.ts` — company name/address/GST/PAN/bank details, already the natural "from" block for a generated PDF.
- PDF generation pattern is well-established: `pdf-lib` + `@pdf-lib/fontkit` + `file-saver`, two house styles:
  - **WelBuilt style** (`offerLetterService.ts`): starts from a pre-made template PDF, whites-out and redraws.
  - **Sparks style** (`sparksOfferLetterService.ts`): builds a blank A4 canvas from scratch — teal (#0D5C63) + gold (#C8A514) palette, left sidebar band, `wrapText()` word-wrap helper, Poppins fonts with Helvetica fallback, embeds `/images/sparks/{logo,seal,signature}.png`, footer disclaimer crediting the parent company. **This is the direct template for the invoice/quotation generator** — same brand, same "Sparks AI is a brand under WelBuilt AI Solutions" footer convention the user asked for.
- Logo assets already in `frontend/public/images/sparks/logo.png` (used) — confirmed present, no need to import anything new from `F:\WELBUILT\Documents`.

## Gaps to fill

1. `Client.gstNumber?: string` — not on the type today; needed for a proper B2B GST invoice ("Bill To" GSTIN line). Optional field, backward compatible.
2. No `brand` field on `Invoice`/`Quotation` — needed so a document can be explicitly issued as Sparks AI (default, per user's request) vs WelBuilt directly. Follows the exact `Intern.brand?: "welbuilt" | "sparks"` precedent already used for offer letters/certificates.
3. No PDF service for Invoice or Quotation at all — build `invoicePdfService.ts` and `quotationPdfService.ts`, following the Sparks-style from-scratch-canvas pattern (dynamic line-item tables need real wrapping/pagination, which the template-based WelBuilt style doesn't support).
4. Quotations page is a monolith with no detail export action and no explicit "map every quotation to a client/project, prompt if missing" flow — the create modal already requires picking or type-ahead-creating a client, so this is smaller than it sounds; main gap is a proper list view with filters/status and a PDF/print action per row, which doesn't exist yet.
5. Server storage: R2 usage today is scattered across ~13 call sites via `r2Service.ts`; needs a drop-in-compatible replacement service (`serverStorageService.ts`?) that preserves the same exported function signatures, backed by new authenticated upload/download endpoints on the existing Express server (`server/index.ts`, already deployed to Dokploy) writing to a Dokploy-managed volume.

## Decisions (self-made, no user input available)

- ⚠️ **GST default**: `gstType: "NONE"` by default on new invoices/quotations, founder toggles to CGST_SGST (intra-state) or IGST (inter-state) per-document — matches how the existing GST fields are already optional/backward-compatible in the type, and matches real invoicing practice (not every WelBuilt/Sparks client is GST-registered, e.g. individual/college clients in SparkED).
- ⚠️ **Invoice brand default**: `"sparks"` — per explicit instruction ("the invoice will be generated in name of Sparks AI for all the software solutions"). Quotation defaults to `"sparks"` too, for consistency (a quotation usually precedes an invoice for the same engagement).
- ⚠️ **GST rate presets**: 0/5/12/18/28% (India GST slabs) — already used in the existing Quotation UI per the survey, carrying the same presets into the invoice UI for consistency.
- ⚠️ **Client GSTIN is optional**, not required — many clients (individuals, colleges) won't have one; the GST block on the PDF simply omits the "Client GSTIN" line if absent, doesn't block invoice creation.
- ⚠️ **IT filing framing**: since this feeds real tax filing, the PDF includes an explicit GST breakdown table (not just a total) whenever `gstType !== "NONE"`, and the invoice retains an immutable-once-issued posture — matches the existing Activity Log's "tamper-proof, tracks performer" compliance pattern already in the app.
- ⚠️ **Storage migration is additive first, cutover second**: new server-storage endpoints get built and wired in as the *new* default path for new uploads; existing R2-stored documents are left as-is (their URLs keep working, R2 credentials stay valid) rather than a risky bulk-migration of live client documents while unsupervised. A full backfill migration is a separate, explicitly-flagged follow-up, not bundled into this pass.

## Build order

1. Firebase 400 fix — DONE.
2. Type additions: `Client.gstNumber?`, `Invoice.brand?`, `Quotation.brand?` (all optional, non-breaking).
3. `invoicePdfService.ts` — Sparks-style branded PDF, GST-aware, footer credits WelBuilt AI Solutions. Wire into `InvoiceDetailPage.tsx`'s dead "Download PDF" button.
4. `quotationPdfService.ts` — same visual system, quotation-specific fields (validity date, terms, "This is a quotation, not a tax invoice" disclaimer when unGSTed). Wire into `QuotationDetailModal`.
5. Quotations page polish — keep the existing modal-based architecture (it already does client/project mapping + prompts for new-client details inline via existing form patterns elsewhere in the app), add: status filter tabs, search, and the PDF download action.
6. Server-side storage — design covered in a dedicated section below since it's architecturally the largest piece.

---

## Server-side storage — detailed design

**Approach (already confirmed with user before they stepped away): Dokploy-managed volume + scheduled backups.**

### Architecture
- Add a named Docker volume to the `welbuilt-erp` Dokploy application (e.g. `welbuilt-documents`), mounted at `/data/documents` inside the container.
- Extend the existing `server/index.ts` Express server (already deployed, already has Firebase Admin auth verification wired via `_r2PresignCore.ts`'s `verifyAuthHeader`) with new routes:
  - `POST /api/storage/upload` — multipart upload (via `multer` with disk storage pointed at the volume path), auth-gated the same way `/api/r2-presign` is, returns `{ fileUrl, fileKey }` matching R2's existing return shape.
  - `GET /api/storage/:fileKey` — streams the file back (auth-gated for private documents; for now treat everything as auth-required, matching R2's presigned-URL-implies-auth model).
  - `DELETE /api/storage/:fileKey` — auth-gated delete.
- New frontend service `serverStorageService.ts` mirrors `r2Service.ts`'s exact exported function signatures (`uploadFileToR2`-equivalent, `getSignedUploadUrl`-equivalent, etc.) so callers don't need to change — only the import source flips. This preserves the "don't break 13 call sites" constraint from the earlier R2-security-fix session.
- File keys follow the same folder-prefix convention already used by R2 (`interns/offer-letters/sparks`, etc.) so the path structure is familiar and sortable.

### Why this over alternatives
- **vs. staying on R2**: user explicitly asked to move off Cloudflare to self-hosted storage.
- **vs. a separate object-storage service (MinIO) in its own container**: more moving parts (another container, another set of credentials, another volume) for no real benefit at this company's scale (internal ERP, not public-facing high-traffic storage) — a volume + Express route is simpler to operate and debug, and reuses the auth layer that's already live in production.
- **vs. mounting a host bind-path directly**: Dokploy-managed named volumes get the platform's built-in backup tooling (`volume-backups`) for free, which the user explicitly chose; a raw bind mount would need a hand-rolled cron/rsync backup instead.

### Backups
- Configure Dokploy's `volume-backups` feature on the new volume once created (via CLI once the volume exists — `dokploy` CLI has backup-related subcommands to investigate at implementation time since they weren't explored this session).
- ⚠️ Backup schedule: default to **daily**, retained per Dokploy's default retention — sensible default for a live business's documents; adjust when the user is back if they want a different cadence.

### Migration posture (existing R2 documents)
- **Not migrated in this pass.** Existing documents keep their R2 URLs and keep working (R2 keys remain valid and unrotated per the earlier explicit instruction). Only new uploads go to the new server storage. This avoids a risky bulk-download-and-reupload of real client/business documents while the user isn't available to verify the result. A full backfill is a natural follow-up once the user confirms the new path is working well in production.

### Risk / rollback
- Additive change — `r2Service.ts` stays untouched and functional; new uploads simply call `serverStorageService.ts` instead. If the Dokploy volume path has any issue, reverting call sites to `r2Service.ts` imports is a one-line-per-file change, no data loss.
