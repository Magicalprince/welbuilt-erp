# Proforma Invoices + Recurring Invoice Templates

Date: 2026-10-23

## Problem

Two related gaps in Finance:
1. Monthly recurring charges (maintenance, hosting) have no template —
   every invoice is entered from scratch each month.
2. There's only one invoice document type. Indian business practice
   distinguishes a **Proforma Invoice** (preliminary, non-GST-binding
   estimate sent before work/payment is confirmed) from the real
   **Tax Invoice** (GST-compliant, payable). Today everything is a Tax
   Invoice from the start.

## Research grounding

A thorough codebase survey (see session transcript) established:
- `invoicePdfService.ts`'s title is literally `"Invoice"`, not
  `"Tax Invoice"` — already parameterizable with near-zero refactor.
- `createInvoice()` in `invoiceService.ts` is the single correct write
  path (batch-writes the invoice + payment schedule, generates the
  number) — new features must call it, not reimplement it.
- Invoice numbering is a hand-rolled "scan all docs, parse last number,
  increment" pattern (`generateInvoiceNumber()`), duplicated verbatim
  in `quotationService.ts` for `QUO-` numbers. Not atomic, but it's the
  established convention — new document types follow the same pattern
  rather than introducing a shared counter.
- All mutation hooks in `useFirestore.ts` share one shape: dynamic
  `import()` inside `mutationFn`, `onSuccess` invalidates a fixed set
  of `queryKeys`. New hooks must match this exactly.
- `InvoiceLineItem` is already a clean, reusable shape — new types
  reference it rather than redefining it.
- `CompanySettings.invoicePrefix` exists but is dead (ignored by
  `generateInvoiceNumber()`). Not wired up as part of this feature —
  out of scope, flagged only so a future session doesn't assume it
  does something.

## Decisions made (self-directed, per explicit instruction to resolve
architecture/engineering questions independently and bring only UI/UX
choices back)

- **Proforma is a separate type, not `Invoice` + a flag.** Real
  structural differences: no `payments[]`, no `paidAmount`, a
  different status set, `validUntil` instead of a payment-driven
  `dueDate`. Reusing `Invoice` would mean a dozen "only meaningful if
  this is a real invoice" optional fields.
- **Proforma→Invoice conversion calls `createInvoice()` directly**,
  never hand-rolls a second write path. Keeps numbering, the payments
  batch-write, and query invalidation centralized.
- **Recurring templates are generated manually**, confirmed with user:
  a "Generate due" action, no cron/background job. No backfill for
  missed months — generates what's currently due only.
- **Templates generate Tax Invoices directly** (confirmed with user),
  not Proformas — monthly maintenance/hosting are routine, already-
  agreed amounts.
- **Two new form pages, not a generalized multi-mode form.**
  `InvoiceFormPage` already branches on edit/create; a third (proforma)
  and fourth (template) mode would overload one file with four
  validation rule-sets and four sets of conditionally-visible fields
  (templates need a billing-day picker and no dates; proformas need
  `validUntil` not `dueDate`; neither has a payment schedule). New
  purpose-built pages copy the line-items/GST sub-UI pattern instead.
- **PDF generation: thread an optional `title` param through the
  existing `invoicePdfService.ts` chain**, default `"Invoice"`. A new
  `proformaInvoicePdfService.ts` adapts a `ProformaInvoice` into the
  `Invoice` shape (they're designed to mirror each other for exactly
  this reason) and calls the existing drawing function with
  `title: "Proforma Invoice"`. Forking the ~400-line drawing function
  into a second copy was rejected — that file has had five rounds of
  real layout bugs fixed already; a fork means re-fixing all of them
  twice over its lifetime.
- **A "Not a Tax Invoice — provisional only" disclaimer line** renders
  under the title whenever `title !== "Invoice"`. Not cosmetic — a
  proforma that reads exactly like a tax invoice on paper is a real
  compliance problem, not just a presentation detail.
- **Separate numbering sequence for proformas** (`PRO-001`...),
  confirmed with user — different legal weight from a real invoice,
  should never be numerically confusable with one.
- **Routes and collections follow existing conventions exactly**:
  `/finance/proformas*` and `/finance/recurring*` mirroring
  `/finance/invoices*`; Firestore collections `proformaInvoices` and
  `recurringInvoiceTemplates` added to `COLLECTIONS`, camelCase plural,
  no nesting — matching `invoices`/`invoicePayments`.
- **Both features live under the Finance hub**, not new top-level
  sidebar entries — confirmed with user, matches the existing
  "Finance hub fans out to sub-pages" pattern.

## Data model

```ts
export type ProformaStatus = "DRAFT" | "SENT" | "CONVERTED" | "EXPIRED" | "CANCELLED";

export interface ProformaInvoice {
  id: string;
  proformaNumber: string;
  clientId: string;
  client?: Client;
  projectId?: string;
  project?: Project;
  issueDate: Date;
  validUntil?: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: ProformaStatus;
  notes?: string;
  brand?: "welbuilt" | "sparks";
  gstType?: GSTType;
  cgstPercent?: number; sgstPercent?: number; igstPercent?: number;
  cgstAmount?: number; sgstAmount?: number; igstAmount?: number;
  convertedToInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RecurringFrequency = "MONTHLY"; // union, so QUARTERLY/YEARLY is
                                             // an additive change later

export interface RecurringInvoiceTemplate {
  id: string;
  templateName: string;
  clientId: string;
  client?: Client;
  projectId?: string;
  lineItems: InvoiceLineItem[];
  discount: number;
  gstType?: GSTType;
  cgstPercent?: number; sgstPercent?: number;
  notes?: string;
  brand?: "welbuilt" | "sparks";
  frequency: RecurringFrequency;
  billingDay: number;            // 1-28 — capped below 29 so a template
                                  // set near month-end never silently
                                  // skips February
  isActive: boolean;
  lastGeneratedPeriod?: string;  // "2026-10"
  lastGeneratedInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Firestore

New `COLLECTIONS` entries: `PROFORMA_INVOICES: "proformaInvoices"`,
`RECURRING_INVOICE_TEMPLATES: "recurringInvoiceTemplates"`.

## Services

**`proformaInvoiceService.ts`** (sibling to `invoiceService.ts`, not
merged — matches the existing `quotationService.ts` precedent of
per-document-type duplication over premature sharing):
- `generateProformaNumber()` (private) — identical scan-and-increment
  pattern, `"PRO-"` prefix.
- `getProformaById`, `getAllProformas`, `getProformasByClient`,
  `createProforma`, `updateProforma`, `deleteProforma`.
- `convertProformaToInvoice(proformaId)` — calls `createInvoice()` from
  `invoiceService.ts` with the proforma's line items/GST/client/project
  mapped across, then marks the proforma `CONVERTED` with
  `convertedToInvoiceId` set.

**`recurringInvoiceService.ts`**:
- CRUD: `createTemplate`, `updateTemplate`, `deleteTemplate`,
  `getAllTemplates`.
- `getDueTemplates(templates)` — pure function, no Firestore call:
  `isActive && lastGeneratedPeriod !== currentPeriod && today >= billingDay`.
  Runs client-side against already-fetched templates for the banner.
- `generateInvoiceFromTemplate(template)` — computes subtotal/GST/total
  from `template.lineItems` (same math as `InvoiceFormPage`), calls
  `createInvoice()`, then stamps `lastGeneratedPeriod`/
  `lastGeneratedInvoiceId` on the template.

## PDF generation

`invoicePdfService.ts`: all four public functions gain an optional
trailing `title: string = "Invoice"` param. One new disclaimer line
gated on `title !== "Invoice"`.

New `proformaInvoicePdfService.ts`: `generateProformaPdfBlob`/
`generateProformaPdfUrl`/`generateAndDownloadProformaPdf`, each mapping
a `ProformaInvoice` into the `Invoice` shape `generateInvoicePdf`
expects, then calling it with `title: "Proforma Invoice"`.

## Hooks (`useFirestore.ts`)

New `queryKeys` entries following the exact `invoices`/`invoice(id)`
tuple convention: `proformas`, `proforma(id)`, `proformasByClient(id)`,
`recurringTemplates`, `recurringTemplate(id)`.

New hooks, each matching the existing dynamic-import `mutationFn` +
`onSuccess` invalidation shape:
`useProformas`, `useProforma(id)`, `useCreateProforma`,
`useUpdateProforma`, `useDeleteProforma`, `useConvertProformaToInvoice`;
`useRecurringTemplates`, `useRecurringTemplate(id)`,
`useCreateRecurringTemplate`, `useUpdateRecurringTemplate`,
`useDeleteRecurringTemplate`, `useGenerateInvoiceFromTemplate`.

## Routes

`/finance/proformas`, `/finance/proformas/new`,
`/finance/proformas/:id`, `/finance/proformas/:id/edit`.
`/finance/recurring`, `/finance/recurring/new`,
`/finance/recurring/:id/edit`. (No detail page for templates — the
edit form doubles as detail, matching how simple the record is; no
payments/PDF history to show beyond the "last generated" stamp, which
renders inline on the list row.)

## UI/UX (confirmed with user)

- **Finance hub**: two new Quick Action tiles, "Proformas" and
  "Recurring", same visual weight as the existing Invoices/Income/
  Expenses/Withdrawals tiles.
- **Recurring Templates list**: a banner at the top when 1+ templates
  are due this month ("3 invoices due this month" + "Generate All Due"
  button), plus a per-row "Generate" button on each due template for
  one-off generation. Already-generated-this-period rows show their
  per-row button disabled/greyed with a "Generated for Oct 2026" note
  instead.
- **Proforma list default filter**: defaults to "Active" (Draft/Sent),
  matching the existing status-filter-button-row pattern already used
  on Invoices/Quotations. Converted/Expired/Cancelled are one filter
  click away, never truly hidden.
- **Proforma editability**: fully editable (client, project, line
  items, GST, notes) right up until conversion, same edit UX as
  `InvoiceFormPage`. Once `status === "CONVERTED"`, the detail page
  becomes read-only and shows a direct link to the resulting Tax
  Invoice.
- **Post-conversion**: converting a Proforma does not delete or hide
  it from the data — it's set to `CONVERTED` and excluded by the
  default "Active" filter, but remains fully findable via the status
  filter. This reconciles "stays as a record" with "removed from the
  active list" — the user's answer was specifically about the default
  *view*, not data retention.

## Verification plan

- `npx tsc -b` + `npx eslint` clean after each new file.
- Full `npm run build` at the end.
- Visual verification of both new PDF outputs (Proforma, template-
  generated invoice) via the established dynamic-import +
  blob-URL-in-iframe Playwright pattern, including the disclaimer line
  rendering correctly and a multi-page stress test reusing the same
  pagination logic already proven in `invoicePdfService.ts`.
- Manual walk-through once implemented: create a template → "Generate
  Due" → confirm a real Tax Invoice appears in Invoices with correct
  numbering → create a Proforma → convert it → confirm the resulting
  Tax Invoice is correct and the Proforma shows as Converted with a
  working link back and forth.
