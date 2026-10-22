# Finance UX upgrades + site-wide pagination

Date: 2026-10-22

## Problem

Income and Expenses pages (`frontend/src/pages/finance/IncomePage.tsx`,
`ExpensesPage.tsx`) render their full dataset as an unfiltered `.map()` list:
no search, no date filtering, no way to export for filing, no pagination.
Separately, no page in the app paginates — every list page renders its
entire filtered array, which doesn't scale as data grows.

## Scope

1. Reusable `Pagination` component + `usePagination` hook (client-side).
2. Search + date-range filtering on Income and Expenses.
3. PDF export: combined Income+Expense statement (on `FinancePage.tsx`) and
   simple per-page exports (Income-only / Expenses-only).
4. Roll `usePagination`/`Pagination` out to every primary list page.

## 1. Pagination

**New files:**
- `frontend/src/components/ui/Pagination.tsx` — controlled component.
  ```tsx
  interface PaginationProps {
    currentPage: number;   // 1-indexed
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  }
  ```
  Renders "Showing X–Y of N" + Prev/Next + numbered page buttons with
  ellipsis collapsing for many pages. Styled with existing `Button`
  variants, not a new visual language.

- `usePagination(items: T[], pageSize = 20)` hook — wraps slice logic:
  ```tsx
  const { paginatedItems, currentPage, setCurrentPage, totalPages } =
    usePagination(filteredItems, 20);
  ```
  Resets to page 1 whenever the input array's length changes (e.g. a new
  search narrows results) — otherwise the user can land on a blank page
  with working-looking controls after filtering.

**Decision: client-side pagination**, not server-side/query pagination.
This is a single-company internal ERP — largest collections are in the
hundreds, not hundreds of thousands. Every list page already pulls the
full collection via React Query with no `limit()`, and several pages
cross-reference other hooks' full results on the same page (e.g. name
lookups). Server-side pagination would mean touching every data hook and
Firestore query for no real benefit at this data scale. Client-side
slicing is a pure UI-layer addition: no changes to data fetching.

**Page size: fixed at 20 rows everywhere.** No per-page selector, no
per-page configurability — one global default.

## 2. Search + Date Range (Income/Expenses)

**Search** — matches the existing `ClientsPage.tsx`/`InvoicesPage.tsx`
pattern exactly: `Input` + `Search` lucide icon, local `useState<string>`,
`useMemo` filter, `relative flex-1 max-w-md` wrapper. Income searches
`description` + client name + project name; Expenses searches
`description` only (no client/project field on expenses).

**Date range** — new `frontend/src/components/ui/DateRangeFilter.tsx`:
two `Input type="date"` ("From"/"To"), empty by default (no filter
applied). Filtering: `date >= from && date <= to` (inclusive), using
`date-fns` (already a dependency) for end-of-day-inclusive comparison on
the "To" date.

Filter bar above each list: `[Search] [From] [To] [Clear filters]`.

**Summary cards recalculate from the filtered set**, not all-time totals —
confirmed with user. Filtering to a date range updates "Total Income" /
category breakdown cards to reflect just that range.

## 3. PDF Export

**New file**: `frontend/src/services/financeStatementPdfService.ts` —
separate from `invoicePdfService.ts` (different document shape: ledger
table, not a single bordered invoice) but matching its visual conventions
(same page size/margins, same font-embedding pattern, same
`wrapText`/`drawRightAligned` helper style, same `ISSUERS` company-info
config) so it reads as the same document family.

**Layout**:
- Header: "Income & Expense Statement" (or "Income Statement" /
  "Expense Statement" for per-page exports) + company block + date range
  covered + generated-on timestamp.
- Bordered tables: Date | Description | Category | Amount, with a
  subtotal row each, for Income then Expenses (combined doc only).
- Closing summary: Total Income, Total Expenses, **Net**, bold.
- Multi-page pagination with repeating header, reusing the row-by-row
  approach already proven in `invoicePdfService.ts`.
- Exports respect whatever search/date filter is currently active on
  screen — "what you see is what exports." No filter active = full
  dataset.

**Placement**: "Export PDF" button on Income page (income-only) and
Expenses page (expenses-only). Combined statement lives on
`FinancePage.tsx` with its own date-range picker, since "combined"
conceptually belongs at the finance hub level.

## 4. Site-wide pagination rollout

Pages getting `usePagination` + `<Pagination>`:
- Finance: Income, Expenses, Invoices
- Core: Clients, Projects
- Leads/CRM: SparksLeadsTab, SparkedLeadsTab, SparkedClientsView,
  ReferrersPanel
- Interns: Certificates, Offer Letters, Payslips, Attendance (4 tabs)
- Other: Documents, Notes, Activity Log, Reports, Quotations

**Explicitly out of scope**: `InvoiceDetailPage`, `InvoiceFormPage`,
`ProjectDetailPage`, `ProjectFormPage`, `SetupPage`. These matched the
earlier `.map()` grep only because they render a small embedded sub-list
(an invoice's own line items, a project's own milestones) or a fixed
wizard-step array — not a primary record list. Pagination there would
actively hurt UX.

**Mechanical pattern per page**: wrap the existing filtered array with
`usePagination`, render `paginatedItems` instead of the full array in the
`.map()`, add `<Pagination />` below the list. No change to data-fetching,
filtering, row rendering, or existing edit/delete/search behavior — purely
inserting a slice + control at the end of an already-existing pipeline.

Given ~15 pages get the same mechanical edit, work through them one at a
time, verifying each still renders/filters/searches correctly before
moving to the next, rather than batch-editing blind.

## Verification

- `npx tsc -b` clean after each page.
- `npx eslint` clean on every touched file.
- Full `npm run build` at the end.
- Visual verification (Playwright, if a live session is available) of:
  Income/Expenses search + date filter + export + pagination end-to-end,
  and at least 2-3 of the other paginated pages to confirm the pattern
  works consistently (e.g. Clients with >20 records, Activity Log).
- Confirm exported PDFs render correctly (page breaks, totals match
  filtered on-screen data) via the same blob-URL-in-iframe Playwright
  pattern used for `invoicePdfService.ts` work previously.
