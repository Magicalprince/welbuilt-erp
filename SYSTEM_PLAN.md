# WelBuilt AI Solutions - ERP-CRM System Plan

## Complete System Architecture & Screen-by-Screen Documentation

---

## 1. SYSTEM OVERVIEW

### 1.1 Application Type
- **Type:** Internal Web Application (SPA - Single Page Application)
- **Users:** 3 Founders Only
- **Access:** Secure login with role = Founder (Super Admin)

### 1.2 Tech Stack (High-End Modern Stack)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 (App Router) | React framework with SSR/SSG |
| **UI Library** | Tailwind CSS + shadcn/ui | Modern, customizable components |
| **Animations** | Framer Motion | Professional page transitions & micro-interactions |
| **Charts** | Recharts / Chart.js | Financial dashboards & analytics |
| **State Management** | Zustand / TanStack Query | Lightweight, efficient state |
| **Backend** | Next.js API Routes / Node.js | API endpoints |
| **Database** | PostgreSQL + Prisma ORM | Structured relational data |
| **Authentication** | NextAuth.js + JWT | Secure auth with 2FA option |
| **File Storage** | AWS S3 / Cloudinary | Document & media storage |
| **Hosting** | Vercel / AWS | Production deployment |
| **Email** | Resend / Nodemailer | Notifications & alerts |

### 1.3 Design Philosophy
- Dark/Light mode support
- Glassmorphism + subtle gradients
- Smooth page transitions (fade, slide)
- Micro-interactions on buttons, cards, inputs
- Skeleton loaders for async content
- Toast notifications for actions

---

## 2. FOUNDER EQUITY & FINANCE LOGIC

### 2.1 Equity Distribution
```
Total Company Revenue = 100%

├── Ramachandraa PS  → 34%
├── Rohith Babu ME   → 33%
└── Baranitharan S   → 33%
```

### 2.2 Finance Tracking Logic

#### Core Concept: "Available Balance" vs "Earned Share"

```
For each founder:

EARNED SHARE = (Total Company Revenue) × (Equity %)
WITHDRAWALS = Sum of all personal withdrawals by that founder
AVAILABLE BALANCE = EARNED SHARE - WITHDRAWALS
```

#### Example Scenario:
```
Company Total Revenue: ₹1,00,000

Ramachandraa's Earned Share: ₹34,000 (34%)
Ramachandraa's Withdrawals: ₹10,000
Ramachandraa's Available Balance: ₹24,000

Even if company revenue grows to ₹2,00,000:
Ramachandraa's NEW Earned Share: ₹68,000
Ramachandraa's Total Withdrawals: ₹10,000 (carried forward)
Ramachandraa's Available Balance: ₹58,000
```

### 2.3 Withdrawal Types

| Type | Description | Deduction From |
|------|-------------|----------------|
| **Personal** | Founder takes for personal use | Founder's Available Balance |
| **Business Expense** | Company operational cost | Company Account (split equally or as defined) |
| **Reimbursement** | Founder paid from pocket, getting back | Company Account → Specific Founder |

### 2.4 Financial Data Model

```
COMPANY FINANCES
├── Total Revenue (sum of all paid invoices)
├── Total Expenses (business costs)
├── Net Profit = Revenue - Expenses
│
├── FOUNDER: Ramachandraa PS (34%)
│   ├── Earned Share: Net Profit × 0.34
│   ├── Withdrawals: [list of withdrawals]
│   ├── Available Balance: Earned - Withdrawn
│   └── Withdrawal History
│
├── FOUNDER: Rohith Babu ME (33%)
│   ├── Earned Share: Net Profit × 0.33
│   ├── Withdrawals: [list of withdrawals]
│   ├── Available Balance: Earned - Withdrawn
│   └── Withdrawal History
│
└── FOUNDER: Baranitharan S (33%)
    ├── Earned Share: Net Profit × 0.33
    ├── Withdrawals: [list of withdrawals]
    ├── Available Balance: Earned - Withdrawn
    └── Withdrawal History
```

---

## 3. COMPLETE SCREEN BREAKDOWN

### 3.0 AUTHENTICATION SCREENS

#### Screen: Login Page
**Route:** `/login`

**Components:**
- Company logo + tagline
- Email input field
- Password input field
- "Remember me" checkbox
- Login button (with loading state)
- "Forgot Password" link
- Optional: OTP/2FA input modal

**Animations:**
- Fade-in on load
- Button pulse on hover
- Shake animation on error

**Functionality:**
- Validate credentials against database
- Generate JWT token on success
- Redirect to Dashboard
- Show error toast on failure
- Lock account after 5 failed attempts

---

#### Screen: Forgot Password
**Route:** `/forgot-password`

**Components:**
- Email input
- Send reset link button
- Back to login link

**Functionality:**
- Send password reset email
- Token-based reset link (expires in 1 hour)

---

#### Screen: Reset Password
**Route:** `/reset-password?token=xxx`

**Components:**
- New password input
- Confirm password input
- Submit button

**Functionality:**
- Validate token
- Update password (hashed)
- Redirect to login

---

### 3.1 DASHBOARD

#### Screen: Main Dashboard
**Route:** `/dashboard`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo | Search | Notifications | Profile Dropdown  │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  SIDE   │   WELCOME SECTION                                 │
│  BAR    │   "Good Morning, Ramachandraa"                    │
│         │   Today's Date | Quick Actions                    │
│ ─────── │                                                   │
│ Dashboard│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ Projects │  │ Active  │ │ Pending │ │ Revenue │ │ Clients │ │
│ Clients  │  │ Projects│ │ Payments│ │ This Mo │ │  Total  │ │
│ Finance  │  │   12    │ │  ₹45K   │ │ ₹1.2L   │ │   28    │ │
│ Documents│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│ Notes    │                                                   │
│ Settings │  FOUNDER FINANCE CARDS (3 columns)               │
│         │  ┌───────────────┬───────────────┬──────────────┐ │
│         │  │ Ramachandraa  │ Rohith Babu   │ Baranitharan │ │
│         │  │ 34%           │ 33%           │ 33%          │ │
│         │  │ ₹40,800       │ ₹39,600       │ ₹39,600      │ │
│         │  │ Available     │ Available     │ Available    │ │
│         │  └───────────────┴───────────────┴──────────────┘ │
│         │                                                   │
│         │  RECENT ACTIVITY FEED                             │
│         │  • Invoice #INV-024 paid - 2 hours ago            │
│         │  • New client added: TechStart Inc - Yesterday    │
│         │  • Project "App Dev" moved to Review - 2 days ago │
│         │                                                   │
│         │  QUICK ACTIONS                                    │
│         │  [+ New Project] [+ New Client] [+ Create Invoice]│
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

**Widgets & Functionality:**

| Widget | Data | Click Action |
|--------|------|--------------|
| Active Projects | Count of status != "Completed" | Go to Projects |
| Pending Payments | Sum of unpaid invoices | Go to Finance |
| Revenue This Month | Sum of paid invoices this month | Go to Finance |
| Total Clients | Count of clients | Go to Clients |
| Founder Cards | Real-time available balance | Go to Finance Detail |
| Recent Activity | Last 10 actions | View full logs |

**Animations:**
- Staggered fade-in for cards
- Counter animation for numbers
- Slide-in for activity feed

---

### 3.2 PROJECT MANAGEMENT

#### Screen: Projects List
**Route:** `/projects`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                     │
├─────────┬───────────────────────────────────────────────────┤
│         │  PROJECTS                          [+ New Project]│
│  SIDE   │                                                   │
│  BAR    │  FILTER BAR                                       │
│         │  [All] [Planning] [Development] [Review] [Live]   │
│         │                                                   │
│         │  SEARCH: [Search projects...]                     │
│         │                                                   │
│         │  VIEW TOGGLE: [Grid] [List] [Kanban]              │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ PROJECT CARD                               │  │
│         │  │ ┌─────────────────────────────────────────┐│  │
│         │  │ │ Project Alpha                    🟢 Live ││  │
│         │  │ │ Client: TechStart Inc                   ││  │
│         │  │ │ Progress: ████████░░ 80%                ││  │
│         │  │ │ Due: 15 Jan 2025                        ││  │
│         │  │ │ Value: ₹75,000                          ││  │
│         │  │ └─────────────────────────────────────────┘│  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  [More project cards...]                          │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

**Functionality:**
- Filter by status
- Search by name/client
- Sort by date, value, status
- Grid/List/Kanban view toggle
- Click card → Project Detail

**Animations:**
- Card hover: subtle lift + shadow
- Filter change: fade transition
- View toggle: smooth morph

---

#### Screen: Project Detail
**Route:** `/projects/[id]`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Projects    PROJECT ALPHA           [Edit] [Del] │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  SIDE   │  PROJECT INFO CARD                                │
│  BAR    │  ┌─────────────────────────────────────────────┐  │
│         │  │ Status: [Dropdown: Planning→Dev→Review→Live]│  │
│         │  │ Client: TechStart Inc (linked)              │  │
│         │  │ Start Date: 01 Dec 2024                     │  │
│         │  │ End Date: 15 Jan 2025                       │  │
│         │  │ Project Value: ₹75,000                      │  │
│         │  │ Payment Status: Partial (₹50,000 received)  │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  TABS: [Overview] [Milestones] [Documents] [Notes]│
│         │                                                   │
│         │  ─── OVERVIEW TAB ───                             │
│         │  Description:                                     │
│         │  Full-stack e-commerce platform with AI...        │
│         │                                                   │
│         │  Scope:                                           │
│         │  • Frontend: React + Next.js                      │
│         │  • Backend: Node.js + PostgreSQL                  │
│         │  • Features: Cart, Payments, Admin Panel          │
│         │                                                   │
│         │  ─── MILESTONES TAB ───                           │
│         │  ☑ Requirement Analysis     - 05 Dec ✓            │
│         │  ☑ UI/UX Design             - 10 Dec ✓            │
│         │  ☐ Frontend Development     - 25 Dec (In Progress)│
│         │  ☐ Backend Integration      - 05 Jan              │
│         │  ☐ Testing & QA             - 10 Jan              │
│         │  ☐ Deployment               - 15 Jan              │
│         │                                                   │
│         │  ─── DOCUMENTS TAB ───                            │
│         │  📄 PRD_ProjectAlpha.pdf                          │
│         │  🎨 Figma_Designs.fig                             │
│         │  📝 Contract_Signed.pdf                           │
│         │  [+ Upload Document]                              │
│         │                                                   │
│         │  ─── NOTES TAB ───                                │
│         │  [Add Note input...]                              │
│         │  • Client requested dark mode - Ramachandraa      │
│         │  • Payment milestone 2 pending - Rohith           │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

**Functionality:**
- Edit project inline
- Change status via dropdown
- Add/complete milestones
- Upload/download documents
- Add project-specific notes
- Link to client profile
- View payment history

---

#### Screen: Create/Edit Project (Modal or Page)
**Route:** `/projects/new` or Modal

**Form Fields:**
```
PROJECT FORM
├── Project Title *
├── Client * (searchable dropdown)
├── Description (rich text editor)
├── Scope (multi-line)
├── Project Value (₹) *
├── Start Date *
├── Expected End Date *
├── Initial Status (Planning/Development)
├── Milestones (repeatable section)
│   ├── Milestone Title
│   ├── Due Date
│   └── [+ Add Milestone]
├── Documents (file upload - multiple)
└── [Cancel] [Save Project]
```

---

### 3.3 CLIENT MANAGEMENT (CRM)

#### Screen: Clients List
**Route:** `/clients`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTS                                      [+ New Client]│
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  SIDE   │  SEARCH: [Search clients...]                      │
│  BAR    │                                                   │
│         │  FILTER: [All] [Active] [Completed] [Prospective] │
│         │                                                   │
│         │  CLIENT CARDS / TABLE                             │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ 👤 TechStart Inc                            │  │
│         │  │    Contact: Arun Kumar                      │  │
│         │  │    Email: arun@techstart.in                 │  │
│         │  │    Projects: 3 | Total Value: ₹2,50,000     │  │
│         │  │    Status: 🟢 Active                        │  │
│         │  │    Last Contact: 2 days ago                 │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  [More client cards...]                           │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

**Functionality:**
- Search by name, company, email
- Filter by status
- Sort by name, value, last contact
- Click → Client Detail

---

#### Screen: Client Detail
**Route:** `/clients/[id]`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    TECHSTART INC                       [Edit] [Del] │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  SIDE   │  CLIENT INFO                                      │
│  BAR    │  ┌─────────────────────────────────────────────┐  │
│         │  │ Company: TechStart Inc                      │  │
│         │  │ Contact Person: Arun Kumar                  │  │
│         │  │ Email: arun@techstart.in                    │  │
│         │  │ Phone: +91 98765 43210                      │  │
│         │  │ Address: Chennai, Tamil Nadu                │  │
│         │  │ Status: Active                              │  │
│         │  │ Source: Referral                            │  │
│         │  │ Client Since: Oct 2024                      │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  TABS: [Projects] [Financials] [Communications]   │
│         │        [Documents] [Notes]                        │
│         │                                                   │
│         │  ─── PROJECTS TAB ───                             │
│         │  • Project Alpha - Live - ₹75,000                 │
│         │  • Project Beta - Development - ₹1,00,000         │
│         │  • Project Starter - Completed - ₹25,000          │
│         │  Total Value: ₹2,00,000                           │
│         │                                                   │
│         │  ─── FINANCIALS TAB ───                           │
│         │  Quotations: 4 sent, 3 approved                   │
│         │  Invoices: 5 generated                            │
│         │  Paid: ₹1,50,000 | Pending: ₹50,000               │
│         │                                                   │
│         │  ─── COMMUNICATIONS TAB ───                       │
│         │  [+ Add Communication Log]                        │
│         │  📧 Email: Sent quotation v2 - 10 Dec             │
│         │  📞 Call: Discussed requirements - 08 Dec         │
│         │  💬 WhatsApp: Shared designs - 05 Dec             │
│         │                                                   │
│         │  ─── DOCUMENTS TAB ───                            │
│         │  📄 NDA_TechStart.pdf                             │
│         │  📄 MSA_Agreement.pdf                             │
│         │                                                   │
│         │  ─── NOTES TAB ───                                │
│         │  • Prefers communication via WhatsApp             │
│         │  • Decision maker is CTO, not CEO                 │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

---

#### Screen: Create/Edit Client
**Route:** `/clients/new` or Modal

**Form Fields:**
```
CLIENT FORM
├── Company Name *
├── Contact Person Name *
├── Email *
├── Phone
├── Secondary Contact (optional)
├── Address
├── Client Status (Prospective / Active / Completed / Inactive)
├── Source (Referral / Website / Social Media / Direct)
├── Notes
└── [Cancel] [Save Client]
```

---

### 3.4 FINANCE & BILLING MODULE

#### Screen: Finance Overview
**Route:** `/finance`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  FINANCE OVERVIEW                                           │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  SIDE   │  COMPANY FINANCIAL SUMMARY                        │
│  BAR    │  ┌─────────────────────────────────────────────┐  │
│         │  │ Total Revenue      Total Expenses   Net Profit│  │
│         │  │ ₹12,50,000        ₹2,30,000        ₹10,20,000│  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  FOUNDER EQUITY BREAKDOWN                         │
│         │  ┌───────────────┬───────────────┬──────────────┐ │
│         │  │ RAMACHANDRAA  │ ROHITH BABU   │ BARANITHARAN │ │
│         │  │ PS (34%)      │ ME (33%)      │ S (33%)      │ │
│         │  │               │               │              │ │
│         │  │ Earned Share  │ Earned Share  │ Earned Share │ │
│         │  │ ₹3,46,800     │ ₹3,36,600     │ ₹3,36,600    │ │
│         │  │               │               │              │ │
│         │  │ Withdrawn     │ Withdrawn     │ Withdrawn    │ │
│         │  │ ₹1,00,000     │ ₹50,000       │ ₹75,000      │ │
│         │  │               │               │              │ │
│         │  │ AVAILABLE     │ AVAILABLE     │ AVAILABLE    │ │
│         │  │ ₹2,46,800     │ ₹2,86,600     │ ₹2,61,600    │ │
│         │  │               │               │              │ │
│         │  │ [Withdraw]    │ [Withdraw]    │ [Withdraw]   │ │
│         │  │ [History]     │ [History]     │ [History]    │ │
│         │  └───────────────┴───────────────┴──────────────┘ │
│         │                                                   │
│         │  COMPANY BANK BALANCE                             │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ Current Balance: ₹7,95,000                  │  │
│         │  │ (Net Profit - All Withdrawals)              │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                   │
│         │  QUICK ACTIONS                                    │
│         │  [+ Record Withdrawal] [+ Add Expense]            │
│         │  [+ Create Invoice] [View All Transactions]       │
│         │                                                   │
│         │  REVENUE CHART (Monthly)                          │
│         │  [Bar/Line chart showing monthly revenue]         │
│         │                                                   │
│         │  SUB-NAVIGATION                                   │
│         │  [Invoices] [Quotations] [Expenses] [Transactions]│
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

**Key Calculations:**
```javascript
// Net Profit
netProfit = totalRevenue - totalExpenses

// Founder Shares
ramachandraaShare = netProfit * 0.34
rohithShare = netProfit * 0.33
baranitharanShare = netProfit * 0.33

// Available Balance (per founder)
availableBalance = earnedShare - totalWithdrawals

// Company Bank Balance
bankBalance = netProfit - (allFounderWithdrawals)
```

---

#### Screen: Record Withdrawal (Modal)
**Route:** Modal on `/finance`

**Form:**
```
RECORD WITHDRAWAL
├── Founder * (Dropdown: Ramachandraa / Rohith / Baranitharan)
├── Amount (₹) *
├── Date *
├── Purpose * (Text input)
├── Category * (Dropdown)
│   ├── Personal Use
│   ├── Salary
│   ├── Reimbursement (to founder)
│   └── Other
├── Notes (optional)
├── Receipt/Proof (file upload - optional)
└── [Cancel] [Record Withdrawal]
```

**Validation:**
- Amount cannot exceed founder's available balance
- Show warning if > 50% of available balance
- Require confirmation for large amounts

**Post-Submit:**
- Deduct from founder's available balance
- Add to withdrawal history
- Log in activity feed
- Update bank balance

---

#### Screen: Withdrawal History
**Route:** `/finance/withdrawals` or Modal

**Layout:**
```
WITHDRAWAL HISTORY
├── Filter by Founder: [All] [Ramachandraa] [Rohith] [Baranitharan]
├── Filter by Date: [This Month] [Last 3 Months] [Custom Range]
│
├── TABLE
│   ┌────────┬────────────┬──────────┬──────────────┬─────────┐
│   │ Date   │ Founder    │ Amount   │ Purpose      │ Category│
│   ├────────┼────────────┼──────────┼──────────────┼─────────┤
│   │ 10 Dec │ Ramachandraa│ ₹25,000 │ Personal exp.│ Personal│
│   │ 05 Dec │ Rohith     │ ₹15,000  │ Equipment    │ Reimburse│
│   │ 01 Dec │ Baranitharan│ ₹20,000 │ Salary       │ Salary  │
│   └────────┴────────────┴──────────┴──────────────┴─────────┘
│
└── SUMMARY
    ├── Ramachandraa Total: ₹1,00,000
    ├── Rohith Total: ₹50,000
    └── Baranitharan Total: ₹75,000
```

---

#### Screen: Invoices
**Route:** `/finance/invoices`

**Layout:**
```
INVOICES                                    [+ Create Invoice]

FILTER: [All] [Paid] [Pending] [Overdue] [Cancelled]

TABLE
┌──────────┬────────────┬──────────┬─────────┬────────┬────────┐
│ Invoice# │ Client     │ Amount   │ Status  │ Due    │ Actions│
├──────────┼────────────┼──────────┼─────────┼────────┼────────┤
│ INV-025  │ TechStart  │ ₹25,000  │ 🟢 Paid │ 15 Dec │ View   │
│ INV-024  │ StartupXYZ │ ₹50,000  │ 🟡 Pending│ 20 Dec│ View   │
│ INV-023  │ DigitalCo  │ ₹30,000  │ 🔴 Overdue│ 01 Dec│ View   │
└──────────┴────────────┴──────────┴─────────┴────────┴────────┘

SUMMARY: Total Pending: ₹80,000 | Overdue: ₹30,000
```

---

#### Screen: Create Invoice
**Route:** `/finance/invoices/new`

**Form:**
```
CREATE INVOICE
├── Invoice Number (auto-generated: INV-XXX)
├── Client * (dropdown, linked to project)
├── Project (optional - dropdown based on client)
├── Invoice Date *
├── Due Date *
├── Line Items (repeatable)
│   ├── Description
│   ├── Quantity
│   ├── Rate
│   └── Amount (auto-calculated)
├── Subtotal (auto)
├── Tax % (optional)
├── Discount (optional)
├── Total (auto)
├── Notes / Terms
├── [Cancel] [Save as Draft] [Send Invoice]
```

---

#### Screen: Invoice Detail
**Route:** `/finance/invoices/[id]`

**Features:**
- View invoice details
- Download as PDF
- Mark as Paid (full or partial)
- Record payment with date and mode
- Send reminder email
- Edit (if not paid)
- Cancel invoice

---

#### Screen: Quotations
**Route:** `/finance/quotations`

**Similar to Invoices but with:**
- Status: Draft / Sent / Approved / Rejected / Expired
- Convert to Invoice action
- Version tracking (v1, v2, etc.)

---

#### Screen: Expenses
**Route:** `/finance/expenses`

**Layout:**
```
EXPENSES                                      [+ Add Expense]

CATEGORIES: [All] [Tools] [Hosting] [APIs] [Marketing] [Other]

TABLE
┌──────────┬─────────────┬──────────┬──────────┬────────────┐
│ Date     │ Description │ Category │ Amount   │ Paid By    │
├──────────┼─────────────┼──────────┼──────────┼────────────┤
│ 10 Dec   │ AWS Hosting │ Hosting  │ ₹5,000   │ Company    │
│ 08 Dec   │ Figma Pro   │ Tools    │ ₹1,200   │ Ramachandraa│
│ 05 Dec   │ OpenAI API  │ APIs     │ ₹2,500   │ Company    │
└──────────┴─────────────┴──────────┴──────────┴────────────┘

MONTHLY TOTAL: ₹8,700
```

**"Paid By" Logic:**
- If Company → Deduct from company expenses (affects net profit)
- If Founder → Track as reimbursable (optional reimbursement later)

---

### 3.5 DOCUMENTS & TEMPLATES

#### Screen: Documents
**Route:** `/documents`

**Layout:**
```
DOCUMENTS                                    [+ Upload Document]

FOLDERS / CATEGORIES
├── 📁 Templates
│   ├── 📄 Email_Template_Quotation.docx
│   ├── 📄 Email_Template_Invoice.docx
│   └── 📄 Proposal_Template.docx
│
├── 📁 Contracts
│   ├── 📄 NDA_Template.pdf
│   └── 📄 MSA_Template.pdf
│
├── 📁 SOPs
│   ├── 📄 Client_Onboarding_SOP.pdf
│   └── 📄 Project_Delivery_SOP.pdf
│
└── 📁 Company
    ├── 📄 Company_Logo.png
    └── 📄 Brand_Guidelines.pdf

ACTIONS: View | Download | Delete | Move
```

---

### 3.6 NOTES & CHECKPOINTS (FOUNDER COLLABORATION)

#### Screen: Notes
**Route:** `/notes`

**Layout:**
```
NOTES & CHECKPOINTS                            [+ New Note]

FILTER: [All] [My Notes] [Checkpoints] [Meeting Notes]
SEARCH: [Search notes...]

NOTES FEED (Card Layout)
┌─────────────────────────────────────────────────────────────┐
│ 📌 CHECKPOINT: Q1 2025 Goals                                │
│ Created by: Ramachandraa | 10 Dec 2024                      │
│ ─────────────────────────────────────────────────────────── │
│ 1. Onboard 5 new clients                                    │
│ 2. Launch internal ERP tool                                 │
│ 3. Revenue target: ₹5L                                      │
│                                                             │
│ Comments:                                                   │
│ • Rohith: Added marketing budget consideration              │
│ • Baranitharan: Agreed, let's prioritize point 2            │
│                                                             │
│ [Edit] [Add Comment] [Pin/Unpin]                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📝 Meeting Notes: Client TechStart Discussion               │
│ Created by: Rohith | 08 Dec 2024                            │
│ ─────────────────────────────────────────────────────────── │
│ Discussed scope expansion for Project Alpha...             │
│                                                             │
│ [Edit] [Add Comment]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Note Types:**
- **Checkpoint:** Important milestones, goals, decisions
- **Meeting Notes:** Discussion summaries
- **General:** Random notes, ideas
- **Task:** Action items (optional)

**Features:**
- Rich text editor
- Pin important notes
- Comment threads
- Filter by type/author
- Search full text

---

#### Screen: Create/Edit Note
**Route:** Modal

**Form:**
```
CREATE NOTE
├── Title *
├── Type * (Checkpoint / Meeting Notes / General / Task)
├── Content (Rich text editor with markdown support)
├── Pin this note? (checkbox)
├── Tags (optional)
└── [Cancel] [Save Note]
```

---

### 3.7 SETTINGS

#### Screen: Settings
**Route:** `/settings`

**Sections:**

```
SETTINGS

├── PROFILE
│   ├── Name
│   ├── Email
│   ├── Phone
│   ├── Profile Picture
│   └── [Save Profile]
│
├── SECURITY
│   ├── Change Password
│   ├── Enable/Disable 2FA
│   ├── Active Sessions
│   └── Logout All Devices
│
├── COMPANY SETTINGS
│   ├── Company Name
│   ├── Company Logo
│   ├── Address
│   ├── GST Number
│   ├── Bank Details (for invoices)
│   └── Invoice Prefix (INV-)
│
├── FOUNDER EQUITY (View Only / Admin Edit)
│   ├── Ramachandraa PS: 34%
│   ├── Rohith Babu ME: 33%
│   └── Baranitharan S: 33%
│
├── NOTIFICATIONS
│   ├── Email notifications for payments
│   ├── Email notifications for overdue invoices
│   └── Daily summary email
│
├── APPEARANCE
│   ├── Theme: Light / Dark / System
│   └── Accent Color
│
└── DATA
    ├── Export All Data (JSON/CSV)
    ├── Backup Database
    └── Audit Logs
```

---

### 3.8 ACTIVITY LOGS

#### Screen: Activity Logs
**Route:** `/settings/logs` or `/logs`

**Layout:**
```
ACTIVITY LOGS

FILTER: [All] [Projects] [Clients] [Finance] [Notes]
DATE RANGE: [Today] [This Week] [This Month] [Custom]

TABLE
┌──────────────────┬─────────────┬──────────────────────────────┐
│ Timestamp        │ User        │ Action                       │
├──────────────────┼─────────────┼──────────────────────────────┤
│ 10 Dec, 14:32    │ Ramachandraa│ Created invoice INV-025      │
│ 10 Dec, 14:15    │ Rohith      │ Updated project Alpha status │
│ 10 Dec, 13:45    │ Baranitharan│ Recorded withdrawal ₹20,000  │
│ 10 Dec, 11:20    │ Ramachandraa│ Added new client DigitalCo   │
└──────────────────┴─────────────┴──────────────────────────────┘
```

---

## 4. DATA MODELS (DATABASE SCHEMA)

### 4.1 Core Entities

```prisma
// User (Founder)
model User {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  password      String   // hashed
  phone         String?
  avatar        String?
  equityPercent Float    // 34, 33, 33
  role          String   @default("FOUNDER")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  withdrawals   Withdrawal[]
  notes         Note[]
  comments      Comment[]
  activityLogs  ActivityLog[]
}

// Client
model Client {
  id            String   @id @default(uuid())
  companyName   String
  contactPerson String
  email         String
  phone         String?
  address       String?
  status        ClientStatus @default(PROSPECTIVE)
  source        String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  projects      Project[]
  invoices      Invoice[]
  quotations    Quotation[]
  communications Communication[]
  documents     Document[]
}

enum ClientStatus {
  PROSPECTIVE
  ACTIVE
  COMPLETED
  INACTIVE
}

// Project
model Project {
  id          String   @id @default(uuid())
  title       String
  description String?
  scope       String?
  status      ProjectStatus @default(PLANNING)
  value       Float
  startDate   DateTime
  endDate     DateTime?
  progress    Int      @default(0) // 0-100
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id])
  milestones  Milestone[]
  documents   Document[]
  notes       ProjectNote[]
  invoices    Invoice[]
}

enum ProjectStatus {
  PLANNING
  DEVELOPMENT
  REVIEW
  LIVE
  MAINTENANCE
  COMPLETED
  ON_HOLD
}

// Milestone
model Milestone {
  id        String   @id @default(uuid())
  title     String
  dueDate   DateTime
  completed Boolean  @default(false)
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
}

// Invoice
model Invoice {
  id           String   @id @default(uuid())
  invoiceNumber String  @unique
  clientId     String
  client       Client   @relation(fields: [clientId], references: [id])
  projectId    String?
  project      Project? @relation(fields: [projectId], references: [id])
  issueDate    DateTime
  dueDate      DateTime
  subtotal     Float
  tax          Float    @default(0)
  discount     Float    @default(0)
  total        Float
  status       InvoiceStatus @default(PENDING)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  lineItems    InvoiceLineItem[]
  payments     Payment[]
}

enum InvoiceStatus {
  DRAFT
  PENDING
  PAID
  PARTIAL
  OVERDUE
  CANCELLED
}

// Invoice Line Item
model InvoiceLineItem {
  id          String  @id @default(uuid())
  description String
  quantity    Float
  rate        Float
  amount      Float
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id])
}

// Payment
model Payment {
  id        String   @id @default(uuid())
  amount    Float
  date      DateTime
  mode      String   // Bank Transfer, UPI, Cash, etc.
  notes     String?
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  createdAt DateTime @default(now())
}

// Quotation
model Quotation {
  id              String   @id @default(uuid())
  quotationNumber String   @unique
  version         Int      @default(1)
  clientId        String
  client          Client   @relation(fields: [clientId], references: [id])
  issueDate       DateTime
  validUntil      DateTime
  subtotal        Float
  tax             Float    @default(0)
  discount        Float    @default(0)
  total           Float
  status          QuotationStatus @default(DRAFT)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  lineItems       QuotationLineItem[]
}

enum QuotationStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  EXPIRED
  CONVERTED
}

// Expense
model Expense {
  id          String   @id @default(uuid())
  description String
  amount      Float
  category    ExpenseCategory
  date        DateTime
  paidBy      String   // "COMPANY" or founder userId
  receipt     String?  // file URL
  notes       String?
  createdAt   DateTime @default(now())
}

enum ExpenseCategory {
  TOOLS
  HOSTING
  APIS
  MARKETING
  TRAVEL
  OFFICE
  OTHER
}

// Withdrawal (Founder taking money)
model Withdrawal {
  id        String   @id @default(uuid())
  founderId String
  founder   User     @relation(fields: [founderId], references: [id])
  amount    Float
  date      DateTime
  purpose   String
  category  WithdrawalCategory
  notes     String?
  receipt   String?
  createdAt DateTime @default(now())
}

enum WithdrawalCategory {
  PERSONAL
  SALARY
  REIMBURSEMENT
  OTHER
}

// Note (Founder collaboration)
model Note {
  id        String   @id @default(uuid())
  title     String
  content   String   // Rich text / Markdown
  type      NoteType
  pinned    Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  comments  Comment[]
  tags      Tag[]
}

enum NoteType {
  CHECKPOINT
  MEETING
  GENERAL
  TASK
}

// Comment (on notes)
model Comment {
  id        String   @id @default(uuid())
  content   String
  noteId    String
  note      Note     @relation(fields: [noteId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}

// Document
model Document {
  id        String   @id @default(uuid())
  name      String
  url       String
  type      String   // PDF, DOCX, etc.
  category  String   // Templates, Contracts, SOPs, etc.
  size      Int      // bytes
  clientId  String?
  client    Client?  @relation(fields: [clientId], references: [id])
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  createdAt DateTime @default(now())
}

// Activity Log
model ActivityLog {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String
  entity    String   // Project, Client, Invoice, etc.
  entityId  String
  details   Json?
  createdAt DateTime @default(now())
}

// Communication Log
model Communication {
  id        String   @id @default(uuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  type      String   // Email, Call, WhatsApp, Meeting
  summary   String
  date      DateTime
  createdAt DateTime @default(now())
}
```

---

## 5. SYSTEM FLOW DIAGRAMS

### 5.1 Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Login  │────▶│ Validate│────▶│ Generate│────▶│Dashboard│
│  Page   │     │  Creds  │     │   JWT   │     │  Load   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │
     │ Failed        │ Invalid
     ▼               ▼
┌─────────┐     ┌─────────┐
│  Error  │     │  Lock   │
│ Message │     │ Account │
└─────────┘     └─────────┘
```

### 5.2 Project Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Planning │───▶│Development│───▶│  Review  │───▶│   Live   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │Maintenance│
                                                └──────────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │ Completed │
                                                └──────────┘
```

### 5.3 Financial Flow

```
┌───────────┐     ┌───────────┐     ┌───────────┐
│ Quotation │────▶│  Invoice  │────▶│  Payment  │
│   Sent    │     │ Generated │     │ Received  │
└───────────┘     └───────────┘     └───────────┘
                        │                 │
                        │                 ▼
                        │           ┌───────────┐
                        │           │  Revenue  │
                        │           │  Logged   │
                        │           └───────────┘
                        │                 │
                        ▼                 ▼
                  ┌───────────┐     ┌───────────┐
                  │  Overdue  │     │  Profit   │
                  │  Alert    │     │ Calculated│
                  └───────────┘     └───────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                  ┌───────────┐     ┌───────────┐     ┌───────────┐
                  │Ramachandraa│    │   Rohith  │     │Baranitharan│
                  │   (34%)   │     │   (33%)   │     │   (33%)   │
                  └───────────┘     └───────────┘     └───────────┘
                        │                 │                 │
                        ▼                 ▼                 ▼
                  ┌───────────┐     ┌───────────┐     ┌───────────┐
                  │Withdrawal │     │Withdrawal │     │Withdrawal │
                  │ Tracking  │     │ Tracking  │     │ Tracking  │
                  └───────────┘     └───────────┘     └───────────┘
```

---

## 6. PAGE TRANSITION & ANIMATION SPECIFICATIONS

### 6.1 Global Animations (Framer Motion)

```javascript
// Page Transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4
};

// Card Stagger Animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Number Counter Animation
const CountUp = ({ end, duration = 2 }) => {
  // Animate from 0 to end value
};
```

### 6.2 Micro-Interactions

| Element | Interaction | Animation |
|---------|-------------|-----------|
| Buttons | Hover | Scale 1.02, shadow increase |
| Buttons | Click | Scale 0.98, ripple effect |
| Cards | Hover | Y translate -4px, shadow |
| Input Focus | Focus | Border glow, label float |
| Sidebar | Item Hover | Background slide |
| Modal | Open | Fade + Scale from center |
| Modal | Close | Fade + Scale to center |
| Toast | Appear | Slide from right |
| Dropdown | Open | Fade + Scale Y |
| Tab Change | Switch | Underline slide |
| Toggle | Switch | Spring animation |

### 6.3 Loading States

- Skeleton screens for content loading
- Shimmer effect on skeletons
- Spinner for actions
- Progress bar for file uploads

---

## 7. RESPONSIVE BREAKPOINTS

```css
/* Mobile First Approach */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Layout Behavior

| Breakpoint | Sidebar | Content | Cards |
|------------|---------|---------|-------|
| < 768px | Hidden (hamburger) | Full width | 1 column |
| 768-1024px | Collapsed (icons) | Full - 64px | 2 columns |
| > 1024px | Expanded (240px) | Full - 240px | 3-4 columns |

---

## 8. FOLDER STRUCTURE

```
welbuilt-erp/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Dashboard layout with sidebar
│   │   │   ├── page.tsx        # Main dashboard
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   ├── finance/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── invoices/
│   │   │   │   ├── quotations/
│   │   │   │   ├── expenses/
│   │   │   │   └── withdrawals/
│   │   │   ├── documents/
│   │   │   ├── notes/
│   │   │   └── settings/
│   │   ├── api/                # API routes
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── clients/
│   │   │   ├── finance/
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── PageTransition.tsx
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── clients/
│   │   ├── finance/
│   │   └── shared/
│   │
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client
│   │   ├── auth.ts             # Auth utilities
│   │   ├── utils.ts            # Helper functions
│   │   └── validations/        # Zod schemas
│   │
│   ├── hooks/                  # Custom React hooks
│   ├── store/                  # Zustand stores
│   ├── types/                  # TypeScript types
│   └── styles/                 # Additional styles
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── public/
│   └── assets/
│
├── .env
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 9. SECURITY CHECKLIST

- [ ] HTTPS enforced
- [ ] Passwords hashed with bcrypt
- [ ] JWT with short expiry + refresh tokens
- [ ] CSRF protection
- [ ] Rate limiting on auth endpoints
- [ ] Input validation (Zod)
- [ ] SQL injection prevention (Prisma)
- [ ] XSS prevention
- [ ] Secure HTTP headers
- [ ] Environment variables for secrets
- [ ] Database backups (daily)
- [ ] Activity logging
- [ ] Session management

---

## 10. DEVELOPMENT PHASES

### Phase 1: Foundation
- Project setup (Next.js, Tailwind, Prisma)
- Authentication system
- Database schema
- Basic layout & navigation

### Phase 2: Core Modules
- Dashboard
- Project Management
- Client Management (CRM)

### Phase 3: Finance Module
- Invoices & Quotations
- Expenses
- Founder equity tracking
- Withdrawal system

### Phase 4: Collaboration & Docs
- Notes & Checkpoints
- Document management
- Activity logs

### Phase 5: Polish
- Animations & transitions
- Responsive design
- Performance optimization
- Testing

---

## 11. SUMMARY

This ERP-CRM system is designed specifically for WelBuilt AI Solutions' 3 founders to manage:

1. **Projects** - Full lifecycle tracking
2. **Clients** - Relationship management
3. **Finance** - Revenue, expenses, and founder equity with withdrawal tracking
4. **Documents** - Centralized storage
5. **Notes** - Founder collaboration

The unique feature is the **Founder Equity & Withdrawal System** that:
- Tracks each founder's 34/33/33 split
- Maintains individual withdrawal history
- Calculates real-time available balance per founder
- Deducts personal withdrawals from individual shares only

---

*Document Version: 1.0*
*Last Updated: December 2024*
