# SparkED Workshop Tracking, Follow-up Redesign & Full-Page Navigation

Builds on `2026-07-28-leads-crm-design.md`. Read that first — this doc only covers what's new/changed.

## Problem

1. Once a SparkED department converts, there was no way to track the actual workshop execution: dates, headcount, cost per student, and a detailed expense breakdown (food, travel, stay, certificates, etc.). A department may run several distinct workshops over time (different years, different topics), so this must be a repeatable record, not a single field set.
2. Follow-ups (both brands) currently capture only a free-text note + optional next-date. Founders want each follow-up to be a fuller meeting record — date, discussion notes, and the current count/amount being discussed (which may have changed since the last follow-up) — and the history view needs a real redesign, not a cramped list.
3. The modal-based drill-down pattern (lead detail, college detail, department detail) doesn't give enough room for this much information. All drill-down *detail* views become full-page (body-swap) views instead of popups; *create* modals (New Lead, New College, New Department, New Workshop) stay as small modals.

## Data model additions

### Workshop (new collection `sparkedWorkshops`)

```ts
type WorkshopStatus = "SCHEDULED" | "COMPLETED";

type WorkshopExpenseCategory =
  | "FOOD" | "TRAVEL" | "STAY" | "CERTIFICATES" | "SPECIAL_PRIZE"
  | "TRAINER_FEE" | "MATERIALS" | "MISCELLANEOUS";

interface WorkshopExpense {
  category: WorkshopExpenseCategory;
  dayAmounts?: number[];   // optional per-day breakdown, founder reference only
  totalAmount: number;     // required — the number all calculations use
}

interface Workshop {
  id: string;
  deptId: string;
  collegeId: string;        // denormalized, avoids a join for analytics
  workshopTitle: string;    // e.g. "Full Stack Development"
  targetYear: string;       // free text, e.g. "2nd Year" or "3rd & 4th Year"
  durationDays: number;
  startDate: Date;
  endDate: Date;
  status: WorkshopStatus;
  studentCount?: number;
  costPerStudent?: number;
  expenses: WorkshopExpense[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Calculated at read time (never stored): `totalEarnings = studentCount × costPerStudent`, `totalExpenses = Σ expenses[].totalAmount`, `netMargin = totalEarnings − totalExpenses`.

**Revenue rule unchanged**: workshop earnings are informational/calculated on the record and rolled into SparkED analytics, but nothing here writes to the `incomes` collection. Recording actual company revenue still requires a manual Income entry, exactly like every other brand in this app.

### Follow-up redesign (both `SparksLeadFollowUp` and `SparkedDeptFollowUp`)

Replace the current `{ note, date }` shape with:

```ts
interface FollowUpRecord {
  id: string;
  leadId: string; // or deptId
  date: Date;
  meetingNotes: string;    // required
  updatedCount?: number;   // optional, prefilled with current value at entry time
  updatedAmount?: number;  // optional, prefilled with current value at entry time
  nextFollowUpDate?: Date;
  loggedBy: string;
  createdAt: Date;
}
```

Submitting a follow-up updates the parent record's live `approxCount`/`rateDiscussed` (SparkED) or `quotedAmount` (Sparks AI) when the founder changes them, so the parent always reflects the latest discussed numbers. The history UI shows each entry as a timeline card (date, notes, and a "Count: X → Y" / "Amount: ₹X → ₹Y" delta chip only when that follow-up actually changed the value) — replacing the current cramped inline list. Built as one reusable `FollowUpTimeline` + `AddFollowUpForm` component pair used identically by both brands.

## Navigation overhaul

Every drill-down becomes a full-page (body-swap) view using local component state — no new routes:

- **Sparks AI**: lead list → lead detail (full page, back button).
- **SparkED**: college grid → college detail (full page) → department detail (full page, nested back) → workshop detail (full page, nested back).
- **Clients page SparkED tab**: analytics header (stat tiles + charts) stays fixed at top always; body area below it swaps between college grid and the same college/department/workshop full-page views as the Leads page (reusing the same components — a college's departments and workshops are the same data whether reached from Leads or Clients).

Create modals (New Lead, New College, New Department, New Workshop, New Referrer) remain small popups — only *viewing/drilling into* an existing record becomes full-page.

## SparkED analytics (Clients page, SparkED tab, above the college grid)

Stat tiles: total colleges, MOU-signed count, total workshops conducted, total students trained.
Charts (Recharts components already in `components/ui/Charts.tsx`): total earnings vs total expenses vs net margin (comparison), expense breakdown by category (`DonutChart`). All computed client-side from `sparkedWorkshops` + `sparkedDepartments` + `sparkedColleges` — no new stored aggregates.

## Service layer

- `workshopService.ts` (new): CRUD for workshops, `getWorkshopsByDept`, `getAllWorkshops`, `getSparkedAnalytics()` (the aggregate numbers for the analytics header).
- `sparksLeadService.ts` / `sparkedLeadService.ts`: follow-up functions (`addFollowUp`/`addDeptFollowUp`) updated to the new `FollowUpRecord` shape and to also patch the parent's count/amount fields when provided.

## UI

- `components/leads/FollowUpTimeline.tsx`, `components/leads/AddFollowUpForm.tsx` (new, shared) — used by both `SparksLeadsTab` and `SparkedLeadsTab`/workshop views.
- `SparksLeadsTab.tsx`: lead detail rewritten from `Modal` to a full-page view.
- `SparkedLeadsTab.tsx`: college detail and department detail rewritten from `Modal` to full-page views; department detail gains a Workshops section (list + "Add Workshop" modal + link into workshop full-page detail).
- `SparkedClientsView.tsx`: gains the analytics header; college card click now drives the same full-page college/department/workshop views (shared components with the Leads page) instead of nothing (previously read-only cards with no drill-down).

## Testing / verification

Same as before: no test framework in this repo; verify via `tsc -b`, `eslint`, `npm run build`, and manual click-through by the user against the live Firebase project.
