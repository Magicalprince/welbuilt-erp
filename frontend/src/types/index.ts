// User / Founder Types
export type UserRole = "FOUNDER" | "INTERN_MANAGER" | "DEACTIVATED";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  equityPercent: number;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Client Types
export type ClientStatus = "PROSPECTIVE" | "ACTIVE" | "COMPLETED" | "INACTIVE";

export interface Client {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  status: ClientStatus;
  source?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Project Types
export type ProjectStatus =
  | "PLANNING"
  | "DESIGN"
  | "DEVELOPMENT"
  | "TESTING"
  | "DEPLOYMENT"
  | "CLOSURE"
  | "ON_HOLD";

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: "pending" | "in_progress" | "completed";
  completedAt?: Date;
}

export interface ProjectMVP {
  id: string;
  projectId: string;
  name: string;
  isChecked: boolean;
  createdAt: Date;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  scope?: string;
  status: ProjectStatus;
  value: number;
  startDate: Date;
  endDate?: Date;
  progress: number;
  clientId: string;
  client?: Client;
  phases: ProjectPhase[];
  mvpFeatures: ProjectMVP[];
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Types
export type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "PARTIAL"
  | "OVERDUE"
  | "CANCELLED";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  description: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: "PENDING" | "PAID" | "OVERDUE";
  paymentMethod?: string;
  createdAt: Date;
}

export type GSTType = "CGST_SGST" | "IGST" | "NONE";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: Client;
  projectId?: string;
  project?: Project;
  issueDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  notes?: string;
  payments: InvoicePayment[];
  brand?: "welbuilt" | "sparks";  // which brand issues this invoice, defaults to "sparks"
  // GST fields — optional for backward compat with existing invoices
  gstType?: GSTType;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Expense Types
export type ExpenseCategory =
  | "TOOLS"
  | "HOSTING"
  | "APIS"
  | "MARKETING"
  | "TRAVEL"
  | "OFFICE"
  | "UTILITIES"
  | "SALARIES"
  | "FOUNDER_WITHDRAWAL"
  | "OTHER";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
  paidBy: string; // "COMPANY" or founder userId
  receipt?: string; // Optional - URL to receipt file
  notes?: string;
  createdAt: Date;
}

// Income Types (non-invoice income like intern payments, project advances, etc.)
export type IncomeCategory =
  | "PROJECT_PAYMENT"
  | "INTERN_PAYMENT"
  | "TESTING_FEE"
  | "CERTIFICATE_FEE"
  | "ADVANCE"
  | "OTHER";

export interface Income {
  id: string;
  description: string;
  amount: number;
  category: IncomeCategory;
  date: Date;
  clientId?: string; // Optional - link to client if applicable
  projectId?: string; // Optional - link to project if applicable
  receivedBy: string; // "COMPANY" or founder userId who received
  receipt?: string; // Optional - URL to receipt/proof
  notes?: string;
  createdAt: Date;
}

// Withdrawal Types
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Withdrawal {
  id: string;
  founderId: string;
  founder?: User;
  amount: number;
  date: Date;
  status: WithdrawalStatus;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
}

// Repayment Types — a founder paying back part of their withdrawn amount
export interface Repayment {
  id: string;
  founderId: string;
  founder?: User;
  amount: number;
  date: Date;
  notes?: string;
  createdAt: Date;
}

// Note Types
export interface NoteCheckpoint {
  id: string;
  text: string;
  isChecked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  projectId?: string;
  clientId?: string;
  isPinned: boolean;
  checkpoints: NoteCheckpoint[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Types
export type DocumentType = "CONTRACT" | "PROPOSAL" | "INVOICE" | "RECEIPT" | "REPORT" | "OTHER";

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  fileUrl?: string; // Optional - URL to file in Cloudflare R2
  fileSize?: number; // Optional - in bytes
  mimeType?: string; // Optional
  projectId?: string;
  clientId?: string;
  invoiceId?: string;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Activity Log Types
export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "PAYMENT"
  | "UPLOAD"
  | "APPROVE"
  | "REJECT"
  | "GENERATE_CERTIFICATE"
  | "GENERATE_OFFER_LETTER"
  | "GENERATE_PAYSLIP"
  | "GENERATE_ATTENDANCE";

export type ActivityEntityType =
  | "PROJECT"
  | "CLIENT"
  | "INVOICE"
  | "EXPENSE"
  | "INCOME"
  | "DOCUMENT"
  | "NOTE"
  | "WITHDRAWAL"
  | "USER"
  | "INTERN"
  | "LEAD";

export interface ActivityLog {
  id: string;
  userId: string;
  user?: User;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  details?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Dashboard Stats
export interface DashboardStats {
  activeProjects: number;
  pendingPayments: number;
  revenueThisMonth: number;
  totalClients: number;
}

export interface FounderFinance {
  id: string;
  name: string;
  equityPercent: number;
  earnedShare: number;
  totalWithdrawals: number;
  availableBalance: number;
}

// Financial Summary
export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  bankBalance: number;
  pendingPayments: number;
  thisMonthRevenue: number;
}

// Communication Types
export type CommunicationType = "EMAIL" | "CALL" | "MEETING" | "MESSAGE";

export interface Communication {
  id: string;
  type: CommunicationType;
  subject: string;
  content?: string;
  clientId?: string;
  projectId?: string;
  participants: string[];
  date: Date;
  duration?: number;
  outcome?: string;
  followUpDate?: Date;
  attachments?: string[];
  createdBy: string;
  createdAt: Date;
}

// Intern Types
export type InternPaymentStatus = "PAID" | "UNPAID";

export type InternDuration = "1-Month" | "2-Month" | "3-Month" | "6-Month";

export type InternMode = "REMOTE" | "HYBRID" | "ON_SITE";

export const INTERN_MODE_LABELS: Record<InternMode, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ON_SITE: "On-Site",
};

export interface Intern {
  id: string;
  internId: string; // WBINT001 / SPINT001 etc.
  brand?: "welbuilt" | "sparks";  // which brand issued this internship
  name: string;
  email: string;
  phone: string;
  college: string;
  year: string; // "1st Year", "2nd Year", "3rd Year", "4th Year"
  domain: string;
  duration: InternDuration;
  startDate: Date;
  endDate: Date;
  issueDate: Date;
  paymentStatus: InternPaymentStatus;
  // Certificate fields
  certificateUrl?: string;
  certificateKey?: string;
  // Offer letter fields
  offerLetterUrl?: string;
  offerLetterKey?: string;
  mode?: InternMode;
  stipend?: number;
  projectTitle?: string;
  // Attendance fields
  attendanceUrl?: string;
  attendanceKey?: string;
  totalInternshipDays?: number;
  daysPresent?: number;
  // Payslip fields
  payslipUrl?: string;
  payslipKey?: string;
  referenceNumber?: string;
  numberOfMonths?: number;
  paymentType?: 'MONTHLY' | 'ONE_TIME';
  createdAt: Date;
  updatedAt: Date;
}

// Quotation Types
export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface QuotationLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  clientId: string;
  client?: Client;
  projectId?: string;
  issueDate: Date;
  validUntil: Date;
  lineItems: QuotationLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: QuotationStatus;
  notes?: string;
  terms?: string;
  brand?: "welbuilt" | "sparks";  // which brand issues this quotation, defaults to "sparks"
  gstType?: GSTType;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  convertedToInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Company Settings
export interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string;
  gstNumber?: string;
  panNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
  invoicePrefix: string;
  invoiceTerms?: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  fiscalYearStart: number;
  updatedAt: Date;
}

// ============================================
// Leads CRM — Sparks AI
// ============================================

export type LeadSource =
  | "REFERRAL"
  | "WEBSITE"
  | "LINKEDIN"
  | "COLD_OUTREACH"
  | "REPEAT_CLIENT"
  | "SOCIAL_MEDIA"
  | "OTHER";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  LINKEDIN: "LinkedIn",
  COLD_OUTREACH: "Cold Outreach",
  REPEAT_CLIENT: "Repeat Client",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
};

export type SparksLeadStatus = "NEW" | "IN_CONVERSATION" | "DROPPED" | "CONVERTED";

export const SPARKS_LEAD_STATUS_LABELS: Record<SparksLeadStatus, string> = {
  NEW: "New",
  IN_CONVERSATION: "In Conversation",
  DROPPED: "Dropped",
  CONVERTED: "Converted",
};

export type CommissionType = "PERCENTAGE" | "FIXED";
export type CommissionStatus = "OWED" | "PAID";

export interface Referrer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferrerStats {
  referrer: Referrer;
  totalReferred: number;
  totalConverted: number;
  commissionOwed: number;
  commissionPaid: number;
}

export interface SparksLead {
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
  referrerId?: string;
  commissionType?: CommissionType;
  commissionValue?: number;
  commissionStatus?: CommissionStatus;
  status: SparksLeadStatus;
  dropReason?: string;
  nextFollowUpDate?: Date;
  convertedClientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SparksLeadFollowUp {
  id: string;
  leadId: string;
  date: Date;
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
  loggedBy: string;
  createdAt: Date;
}

// ============================================
// Leads CRM — SparkED
// ============================================

export type MouScope = "NONE" | "COLLEGE_WIDE" | "PARTIAL";

export interface SparkedCollege {
  id: string;
  collegeName: string;
  address: string;
  mouScope: MouScope;
  createdAt: Date;
  updatedAt: Date;
}

export type SparkedDeptStatus = "NEW" | "IN_CONVERSATION" | "DROPPED" | "CONVERTED" | "MOU_SIGNED";

export const SPARKED_DEPT_STATUS_LABELS: Record<SparkedDeptStatus, string> = {
  NEW: "New",
  IN_CONVERSATION: "In Conversation",
  DROPPED: "Dropped",
  CONVERTED: "Converted",
  MOU_SIGNED: "MOU Signed",
};

export type MouSignedVia = "DEPARTMENT" | "COLLEGE_WIDE";

export interface SparkedDepartment {
  id: string;
  collegeId: string;
  deptName: string;
  contactName: string;
  contactNumber: string;
  contactEmail?: string;
  approachedByName: string;
  approachedByNumber: string;
  dateFirstSpoken: Date;
  meetingDescription: string;
  rateDiscussed?: number;
  approxCount?: number;
  notes?: string;
  status: SparkedDeptStatus;
  dropReason?: string;
  mouSignedVia?: MouSignedVia;
  nextFollowUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SparkedDeptFollowUp {
  id: string;
  deptId: string;
  date: Date;
  meetingNotes: string;
  updatedCount?: number;
  updatedAmount?: number;
  nextFollowUpDate?: Date;
  loggedBy: string;
  createdAt: Date;
}

export interface SparkedCollegeWithDepts {
  college: SparkedCollege;
  departments: SparkedDepartment[];
}

// ============================================
// Leads CRM — SparkED Workshops
// ============================================

export type WorkshopStatus = "SCHEDULED" | "COMPLETED";

export const WORKSHOP_STATUS_LABELS: Record<WorkshopStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
};

export type WorkshopExpenseCategory =
  | "FOOD"
  | "TRAVEL"
  | "STAY"
  | "CERTIFICATES"
  | "SPECIAL_PRIZE"
  | "TRAINER_FEE"
  | "MATERIALS"
  | "MISCELLANEOUS";

export const WORKSHOP_EXPENSE_CATEGORY_LABELS: Record<WorkshopExpenseCategory, string> = {
  FOOD: "Food",
  TRAVEL: "Travel",
  STAY: "Stay / Accommodation",
  CERTIFICATES: "Certificates",
  SPECIAL_PRIZE: "Special Prize",
  TRAINER_FEE: "Trainer / Speaker Fee",
  MATERIALS: "Materials / Kit",
  MISCELLANEOUS: "Miscellaneous",
};

export interface WorkshopExpense {
  category: WorkshopExpenseCategory;
  dayAmounts?: number[];
  totalAmount: number;
}

export interface Workshop {
  id: string;
  deptId: string;
  collegeId: string;
  workshopTitle: string;
  targetYear: string;
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

export interface WorkshopFinancials {
  totalEarnings: number;
  totalExpenses: number;
  netMargin: number;
}

export interface SparkedAnalytics {
  totalColleges: number;
  mouSignedColleges: number;
  totalWorkshops: number;
  totalStudentsTrained: number;
  totalEarnings: number;
  totalExpenses: number;
  netMargin: number;
  expenseByCategory: Record<WorkshopExpenseCategory, number>;
}
