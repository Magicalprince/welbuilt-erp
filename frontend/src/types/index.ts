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
  | "INTERN";

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
  internId: string; // WBINT001, WBINT002, etc.
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
