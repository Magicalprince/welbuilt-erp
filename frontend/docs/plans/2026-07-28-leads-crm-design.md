# Leads CRM — Sparks AI & SparkED

## Problem

WelBuilt AI Solutions runs two brands — Sparks AI (software projects: web/app/automation) and SparkED (workshops, cohorts). There is no lead-tracking system today; clients only exist once a deal is already won. Founders need to track prospects from first contact through conversion, per-brand, with referrer/commission tracking (Sparks AI) and college/department outreach tracking (SparkED).

## Scope

- Sparks AI: lead pipeline with referrer tracking and follow-up history, converting to the existing Client/Project system.
- SparkED: college → department outreach pipeline with follow-up history and MOU signing (department-level or college-wide), surfaced as SparkED-specific client cards — structurally separate from Sparks AI clients.
- SparkED cohorts/courses (individual, non-college leads): **out of scope**, future work.
- Formal Quotation documents at lead stage: **out of scope** — lead just carries a numeric `quotedAmount`.

## Non-negotiable constraint

Revenue/income is recorded **only** on the existing Income page (established architecture — see commit `cab91be`, "Decouple invoice payments from revenue/equity tracking"). Nothing in this feature — lead conversion, MOU signing, SparkED client cards — writes to `incomes`. Founders manually log real payments received, exactly as today.

## Data model

### Sparks AI

**`referrers` collection**
```ts
interface Referrer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
Aggregated stats (total referred, total converted, commission owed/paid) are computed at read time from `sparksLeads` that reference the referrer — not stored redundantly.

**`sparksLeads` collection**
```ts
type LeadSource = "REFERRAL" | "WEBSITE" | "LINKEDIN" | "COLD_OUTREACH" | "REPEAT_CLIENT" | "SOCIAL_MEDIA" | "OTHER";
type SparksLeadStatus = "NEW" | "IN_CONVERSATION" | "DROPPED" | "CONVERTED";
type CommissionType = "PERCENTAGE" | "FIXED";
type CommissionStatus = "OWED" | "PAID";

interface SparksLead {
  id: string;
  leadName: string;
  contactNumber: string;
  source: LeadSource;
  projectName: string;
  description: string;
  email?: string;
  address?: string;
  quotedAmount?: number;
  quotationNotes?: string;
  referrerId?: string;              // set when source === REFERRAL
  commissionType?: CommissionType;
  commissionValue?: number;
  commissionStatus?: CommissionStatus;
  status: SparksLeadStatus;         // default NEW
  dropReason?: string;              // shown/required when status === DROPPED
  nextFollowUpDate?: Date;
  convertedClientId?: string;       // set on conversion
  createdAt: Date;
  updatedAt: Date;
}
```

**`sparksLeadFollowUps` collection**
```ts
interface SparksLeadFollowUp {
  id: string;
  leadId: string;
  date: Date;
  note: string;
  loggedBy: string; // userId
  createdAt: Date;
}
```

### SparkED

**`sparkedColleges` collection**
```ts
type MouScope = "NONE" | "COLLEGE_WIDE" | "PARTIAL";

interface SparkedCollege {
  id: string;
  collegeName: string;
  address: string;
  mouScope: MouScope; // derived/set by service logic, stored for quick reads
  createdAt: Date;
  updatedAt: Date;
}
```

**`sparkedDepartments` collection**
```ts
type SparkedDeptStatus = "NEW" | "IN_CONVERSATION" | "DROPPED" | "CONVERTED" | "MOU_SIGNED";
type MouSignedVia = "DEPARTMENT" | "COLLEGE_WIDE";

interface SparkedDepartment {
  id: string;
  collegeId: string;
  deptName: string;
  contactName: string;
  contactNumber: string;
  contactEmail?: string;
  dateFirstSpoken: Date;
  meetingDescription: string;
  rateDiscussed?: number;
  approxCount?: number;
  notes?: string;
  status: SparkedDeptStatus; // default NEW
  dropReason?: string;
  mouSignedVia?: MouSignedVia;
  nextFollowUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**`sparkedDeptFollowUps` collection** — same shape as `sparksLeadFollowUps`, keyed by `deptId`.

Counts are always computed, never stored: total leads = count of `sparkedDepartments`; total colleges = count of `sparkedColleges`; per-college badges = filtered department counts for that `collegeId`.

## Service layer

New files under `frontend/src/services/`:
- `referrerService.ts` — CRUD + `getReferrerStats(referrerId)` (referred/converted counts, commission totals) + `getAllReferrersWithStats()`
- `sparksLeadService.ts` — CRUD, `addFollowUp`, `getFollowUpsByLead`, `convertLeadToClient(leadId)` (dedup-checks existing clients by email/phone, creates or links, sets `convertedClientId` + status)
- `sparkedLeadService.ts` — college CRUD, department CRUD, `addDeptFollowUp`, `signDepartmentMou(deptId)`, `signCollegeWideMou(collegeId)` (batch-updates all depts under the college), `getCollegesWithDeptStats()` (join for card rendering)

All follow existing patterns: `stripUndefined` via the shared `createDocument`/`updateDocument` helpers, Firestore `Timestamp` conversion helpers matching `withdrawalService.ts`/`internService.ts` conventions, activity logging via `activityLogService.ts` (new log helpers: `logLeadCreated`, `logLeadConverted`, `logLeadStatusChanged`, `logMouSigned` — entity type `LEAD` added to `ActivityEntityType`).

## UI

**Routing/nav**: new `/leads` route, sidebar entry between Clients and Finance (icon: `Target` or `UserPlus` from lucide-react). Founder-only automatically, since the sidebar already renders `allNavItems` only for non-`INTERN_MANAGER` roles and `DashboardLayout` restricts `INTERN_MANAGER` to `/interns` only — no new guard code needed.

**`LeadsPage.tsx`** — brand toggle (Sparks AI ⇄ SparkED), identical visual pattern to `OfferLettersTab`'s brand toggle. Renders `SparksLeadsTab` or `SparkedLeadsTab`.

**`SparksLeadsTab`**:
- Table/card list, filters: status, source, search (name/project/phone).
- Status badges color-coded (New=slate, In Conversation=amber, Dropped=red, Converted=green).
- "New Lead" modal: required fields enforced (leadName, contactNumber, source, projectName, description), referrer fields conditionally shown when source=Referral with a referrer search/quick-add combobox.
- Lead detail (modal or drawer): full info, follow-up log (add note + optional next-follow-up date), status changer (dropdown; selecting Dropped prompts for `dropReason`), "Convert to Client" button.
- Convert flow: checks existing clients by email/phone client-side (query clients, compare), shows match-found confirmation UI or proceeds to create; navigates to the client page after.
- Overdue follow-ups (nextFollowUpDate < today, status not Dropped/Converted) surfaced with a visual indicator, sortable to top.

**Referrers**: a simple list view reachable from the Sparks AI tab ("Referrers" button/link) — cards showing name/phone, total referred, total converted, commission owed/paid, expandable to see each referred lead. New/edit referrer modal.

**`SparkedLeadsTab`**:
- College cards (grid), each showing collegeName, address, dept count, status breakdown chips (e.g. "2 Signed · 1 In Conversation").
- "New College" creates a `SparkedCollege`; inside its detail view, "Add Department" adds a `SparkedDepartment` row.
- Department rows: full field set, status changer, follow-up log (same component reused from Sparks AI, parameterized by collection), "Sign MOU" (department-level) button.
- College detail view has a "Sign College-Wide MOU" action (confirmation dialog explaining it marks all departments), visible whenever ≥1 department is not yet MOU_SIGNED.

**Clients page** gets the same brand toggle. Sparks AI tab = existing `ClientsPage` content, untouched. SparkED tab = new `SparkedClientsTab`: cards for every `SparkedCollege` with ≥1 department at `CONVERTED` or `MOU_SIGNED`, showing dept breakdown, aggregate signed/pursued counts, total headcount across signed depts, contacts. No invoice/payment UI. Colleges with zero converted/signed departments stay on the Leads page only.

## Error handling / edge cases

- Deleting a referrer that has leads referencing it: block with a toast (referential integrity, matches how other services handle FK-like relations here — no cascading delete).
- Deleting a college cascades to its departments and their follow-ups (matches `projectService.deleteProject` cascade pattern for phases/MVP features).
- Empty states for all list/grid views (no leads yet, no colleges yet) matching existing empty-state patterns (e.g. `InternsPage`).
- Status transition validation: converting requires status ∈ {NEW, IN_CONVERSATION} to avoid double-converting a `DROPPED` or already-`CONVERTED` lead; UI disables the Convert button otherwise rather than erroring after the fact.

## Testing / verification

No test framework exists in this repo (no test runner in `package.json`); verification follows the project's existing practice: `tsc -b`, `eslint`, `npm run build`, and manual click-through by the user against the live Firebase project (no local emulator configured).
