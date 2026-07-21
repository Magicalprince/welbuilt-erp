import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Client,
  ClientStatus,
  Project,
  ProjectStatus,
  Invoice,
  InvoiceStatus,
  Expense,
  ExpenseCategory,
  Income,
  IncomeCategory,
  Withdrawal,
  Repayment,
  Note,
  Document,
  DocumentType,
  CompanySettings,
} from "@/types";

// ============================================
// Query Keys
// ============================================
export const queryKeys = {
  // Users
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
  founders: ["founders"] as const,
  founderFinances: ["founderFinances"] as const,

  // Clients
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  clientsByStatus: (status: ClientStatus) => ["clients", "status", status] as const,
  clientWithStats: (id: string) => ["clients", id, "stats"] as const,
  activeClientsCount: ["clients", "activeCount"] as const,

  // Projects
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectsByClient: (clientId: string) => ["projects", "client", clientId] as const,
  projectsByStatus: (status: ProjectStatus) => ["projects", "status", status] as const,
  activeProjectsCount: ["projects", "activeCount"] as const,

  // Invoices
  invoices: ["invoices"] as const,
  invoice: (id: string) => ["invoices", id] as const,
  invoicesByClient: (clientId: string) => ["invoices", "client", clientId] as const,
  invoicesByProject: (projectId: string) => ["invoices", "project", projectId] as const,
  invoicesByStatus: (status: InvoiceStatus) => ["invoices", "status", status] as const,
  pendingPaymentsTotal: ["invoices", "pendingTotal"] as const,

  // Expenses
  expenses: ["expenses"] as const,
  expense: (id: string) => ["expenses", id] as const,
  expensesByCategory: (category: ExpenseCategory) => ["expenses", "category", category] as const,
  thisMonthExpenses: ["expenses", "thisMonth"] as const,

  // Incomes (non-invoice income)
  incomes: ["incomes"] as const,
  income: (id: string) => ["incomes", id] as const,
  incomesByCategory: (category: string) => ["incomes", "category", category] as const,
  incomesByClient: (clientId: string) => ["incomes", "client", clientId] as const,
  incomesByProject: (projectId: string) => ["incomes", "project", projectId] as const,
  thisMonthIncomes: ["incomes", "thisMonth"] as const,
  totalIncome: ["incomes", "total"] as const,

  // Finance
  financialSummary: ["finance", "summary"] as const,
  totalRevenue: ["finance", "totalRevenue"] as const,
  totalExpenses: ["finance", "totalExpenses"] as const,
  netProfit: ["finance", "netProfit"] as const,
  companyBankBalance: ["finance", "bankBalance"] as const,

  // Withdrawals
  withdrawals: ["withdrawals"] as const,
  withdrawal: (id: string) => ["withdrawals", id] as const,
  withdrawalsByFounder: (founderId: string) => ["withdrawals", "founder", founderId] as const,
  pendingWithdrawals: ["withdrawals", "pending"] as const,

  // Repayments
  repayments: ["repayments"] as const,
  repaymentsByFounder: (founderId: string) => ["repayments", "founder", founderId] as const,

  // Notes
  notes: ["notes"] as const,
  note: (id: string) => ["notes", id] as const,
  notesByProject: (projectId: string) => ["notes", "project", projectId] as const,
  notesByClient: (clientId: string) => ["notes", "client", clientId] as const,
  pinnedNotes: ["notes", "pinned"] as const,

  // Documents
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  documentsByType: (type: DocumentType) => ["documents", "type", type] as const,
  documentsByProject: (projectId: string) => ["documents", "project", projectId] as const,
  documentsByClient: (clientId: string) => ["documents", "client", clientId] as const,

  // Activity Logs
  activityLogs: ["activityLogs"] as const,
  recentActivityLogs: (count: number) => ["activityLogs", "recent", count] as const,
  activityLogsByUser: (userId: string) => ["activityLogs", "user", userId] as const,

  // Settings
  companySettings: ["settings", "company"] as const,
};

// ============================================
// User Hooks
// ============================================
export function useFounders() {
  return useQuery({
    queryKey: queryKeys.founders,
    queryFn: async () => {
      const { getAllFounders } = await import("@/services/userService");
      return getAllFounders();
    },
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: async () => {
      const { getUserById } = await import("@/services/userService");
      return getUserById(userId);
    },
    enabled: !!userId,
  });
}

export function useFounderFinances() {
  return useQuery({
    queryKey: queryKeys.founderFinances,
    queryFn: async () => {
      const { getFounderFinances } = await import("@/services/userService");
      return getFounderFinances();
    },
  });
}

// ============================================
// Client Hooks
// ============================================
export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: async () => {
      const { getAllClients } = await import("@/services/clientService");
      return getAllClients();
    },
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.client(clientId),
    queryFn: async () => {
      const { getClientById } = await import("@/services/clientService");
      return getClientById(clientId);
    },
    enabled: !!clientId,
  });
}

export function useClientWithStats(clientId: string) {
  return useQuery({
    queryKey: queryKeys.clientWithStats(clientId),
    queryFn: async () => {
      const { getClientWithStats } = await import("@/services/clientService");
      return getClientWithStats(clientId);
    },
    enabled: !!clientId,
  });
}

export function useClientsByStatus(status: ClientStatus) {
  return useQuery({
    queryKey: queryKeys.clientsByStatus(status),
    queryFn: async () => {
      const { getClientsByStatus } = await import("@/services/clientService");
      return getClientsByStatus(status);
    },
  });
}

export function useActiveClientsCount() {
  return useQuery({
    queryKey: queryKeys.activeClientsCount,
    queryFn: async () => {
      const { getActiveClientsCount } = await import("@/services/clientService");
      return getActiveClientsCount();
    },
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Client, "id" | "createdAt" | "updatedAt">) => {
      const { createClient } = await import("@/services/clientService");
      return createClient(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      data,
    }: {
      clientId: string;
      data: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>;
    }) => {
      const { updateClient } = await import("@/services/clientService");
      return updateClient(clientId, data);
    },
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(clientId) });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { deleteClient } = await import("@/services/clientService");
      return deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

// ============================================
// Project Hooks
// ============================================
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const { getAllProjects } = await import("@/services/projectService");
      return getAllProjects();
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: async () => {
      const { getProjectById } = await import("@/services/projectService");
      return getProjectById(projectId);
    },
    enabled: !!projectId,
  });
}

export function useProjectsByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.projectsByClient(clientId),
    queryFn: async () => {
      const { getProjectsByClient } = await import("@/services/projectService");
      return getProjectsByClient(clientId);
    },
    enabled: !!clientId,
  });
}

export function useProjectsByStatus(status: ProjectStatus) {
  return useQuery({
    queryKey: queryKeys.projectsByStatus(status),
    queryFn: async () => {
      const { getProjectsByStatus } = await import("@/services/projectService");
      return getProjectsByStatus(status);
    },
  });
}

export function useActiveProjectsCount() {
  return useQuery({
    queryKey: queryKeys.activeProjectsCount,
    queryFn: async () => {
      const { getActiveProjectsCount } = await import("@/services/projectService");
      return getActiveProjectsCount();
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      data,
      mvpFeatures,
    }: {
      data: Omit<Project, "id" | "createdAt" | "updatedAt" | "phases" | "mvpFeatures" | "progress">;
      mvpFeatures?: string[];
    }) => {
      const { createProject } = await import("@/services/projectService");
      return createProject(data, mvpFeatures);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt" | "phases" | "mvpFeatures">>;
    }) => {
      const { updateProject } = await import("@/services/projectService");
      return updateProject(projectId, data);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { deleteProject } = await import("@/services/projectService");
      return deleteProject(projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useToggleMVPFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      mvpId,
      isChecked,
      projectId,
    }: {
      mvpId: string;
      isChecked: boolean;
      projectId: string;
    }) => {
      const { toggleMVPFeature, updateProjectProgress } = await import("@/services/projectService");
      await toggleMVPFeature(mvpId, isChecked);
      return updateProjectProgress(projectId);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useAddMVPFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
    }: {
      projectId: string;
      name: string;
    }) => {
      const { addMVPFeature } = await import("@/services/projectService");
      return addMVPFeature(projectId, name);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdatePhaseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      phaseId,
      status,
      projectId,
    }: {
      phaseId: string;
      status: "pending" | "in_progress" | "completed";
      projectId: string;
    }) => {
      const { updatePhaseStatus, updateProjectProgress } = await import("@/services/projectService");
      await updatePhaseStatus(phaseId, status);
      return updateProjectProgress(projectId);
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

// ============================================
// Invoice Hooks
// ============================================
export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => {
      const { getAllInvoices } = await import("@/services/invoiceService");
      return getAllInvoices();
    },
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoice(invoiceId),
    queryFn: async () => {
      const { getInvoiceById } = await import("@/services/invoiceService");
      return getInvoiceById(invoiceId);
    },
    enabled: !!invoiceId,
  });
}

export function useInvoicesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.invoicesByClient(clientId),
    queryFn: async () => {
      const { getInvoicesByClient } = await import("@/services/invoiceService");
      return getInvoicesByClient(clientId);
    },
    enabled: !!clientId,
  });
}

export function useInvoicesByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.invoicesByProject(projectId),
    queryFn: async () => {
      const { getInvoicesByProject } = await import("@/services/invoiceService");
      return getInvoicesByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useInvoicesByStatus(status: InvoiceStatus) {
  return useQuery({
    queryKey: queryKeys.invoicesByStatus(status),
    queryFn: async () => {
      const { getInvoicesByStatus } = await import("@/services/invoiceService");
      return getInvoicesByStatus(status);
    },
  });
}

export function usePendingPaymentsTotal() {
  return useQuery({
    queryKey: queryKeys.pendingPaymentsTotal,
    queryFn: async () => {
      const { getPendingPaymentsTotal } = await import("@/services/invoiceService");
      return getPendingPaymentsTotal();
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      data,
      paymentSchedule,
    }: {
      data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt" | "payments" | "paidAmount">;
      paymentSchedule?: { description: string; amount: number; dueDate: Date }[];
    }) => {
      const { createInvoice } = await import("@/services/invoiceService");
      return createInvoice(data, paymentSchedule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPaymentsTotal });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      data,
    }: {
      invoiceId: string;
      data: Partial<Omit<Invoice, "id" | "createdAt" | "updatedAt" | "payments">>;
    }) => {
      const { updateInvoice } = await import("@/services/invoiceService");
      return updateInvoice(invoiceId, data);
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPaymentsTotal });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      paymentMethod,
    }: {
      paymentId: string;
      paymentMethod: string;
      invoiceId: string;
    }) => {
      const { recordPayment } = await import("@/services/invoiceService");
      return recordPayment(paymentId, paymentMethod);
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPaymentsTotal });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { deleteInvoice } = await import("@/services/invoiceService");
      return deleteInvoice(invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingPaymentsTotal });
    },
  });
}

// ============================================
// Finance Hooks
// ============================================
export function useFinancialSummary() {
  return useQuery({
    queryKey: queryKeys.financialSummary,
    queryFn: async () => {
      const { getFinancialSummary } = await import("@/services/financeService");
      return getFinancialSummary();
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: async () => {
      const { getAllExpenses } = await import("@/services/financeService");
      return getAllExpenses();
    },
  });
}

export function useThisMonthExpenses() {
  return useQuery({
    queryKey: queryKeys.thisMonthExpenses,
    queryFn: async () => {
      const { getThisMonthExpenses } = await import("@/services/financeService");
      return getThisMonthExpenses();
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Expense, "id" | "createdAt">) => {
      const { createExpense } = await import("@/services/financeService");
      return createExpense(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthExpenses });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { deleteExpense } = await import("@/services/financeService");
      return deleteExpense(expenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthExpenses });
    },
  });
}

// ============================================
// Income Hooks (non-invoice income)
// ============================================
export function useIncomes() {
  return useQuery({
    queryKey: queryKeys.incomes,
    queryFn: async () => {
      const { getAllIncomes } = await import("@/services/incomeService");
      return getAllIncomes();
    },
  });
}

export function useIncome(incomeId: string) {
  return useQuery({
    queryKey: queryKeys.income(incomeId),
    queryFn: async () => {
      const { getIncomeById } = await import("@/services/incomeService");
      return getIncomeById(incomeId);
    },
    enabled: !!incomeId,
  });
}

export function useIncomesByCategory(category: IncomeCategory) {
  return useQuery({
    queryKey: queryKeys.incomesByCategory(category),
    queryFn: async () => {
      const { getIncomesByCategory } = await import("@/services/incomeService");
      return getIncomesByCategory(category);
    },
  });
}

export function useIncomesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.incomesByClient(clientId),
    queryFn: async () => {
      const { getIncomesByClient } = await import("@/services/incomeService");
      return getIncomesByClient(clientId);
    },
    enabled: !!clientId,
  });
}

export function useIncomesByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.incomesByProject(projectId),
    queryFn: async () => {
      const { getIncomesByProject } = await import("@/services/incomeService");
      return getIncomesByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useThisMonthIncomes() {
  return useQuery({
    queryKey: queryKeys.thisMonthIncomes,
    queryFn: async () => {
      const { getThisMonthIncomes } = await import("@/services/incomeService");
      return getThisMonthIncomes();
    },
  });
}

export function useTotalIncome() {
  return useQuery({
    queryKey: queryKeys.totalIncome,
    queryFn: async () => {
      const { getTotalIncome } = await import("@/services/incomeService");
      return getTotalIncome();
    },
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Income, "id" | "createdAt">) => {
      const { createIncome } = await import("@/services/incomeService");
      return createIncome(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthIncomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.totalIncome });
    },
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      incomeId,
      data,
    }: {
      incomeId: string;
      data: Partial<Omit<Income, "id" | "createdAt">>;
    }) => {
      const { updateIncome } = await import("@/services/incomeService");
      return updateIncome(incomeId, data);
    },
    onSuccess: (_, { incomeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.income(incomeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthIncomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.totalIncome });
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incomeId: string) => {
      const { deleteIncome } = await import("@/services/incomeService");
      return deleteIncome(incomeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthIncomes });
      queryClient.invalidateQueries({ queryKey: queryKeys.totalIncome });
    },
  });
}

// ============================================
// Withdrawal Hooks
// ============================================
export function useWithdrawals() {
  return useQuery({
    queryKey: queryKeys.withdrawals,
    queryFn: async () => {
      const { getAllWithdrawals } = await import("@/services/withdrawalService");
      return getAllWithdrawals();
    },
  });
}

export function useWithdrawalsByFounder(founderId: string) {
  return useQuery({
    queryKey: queryKeys.withdrawalsByFounder(founderId),
    queryFn: async () => {
      const { getWithdrawalsByFounder } = await import("@/services/withdrawalService");
      return getWithdrawalsByFounder(founderId);
    },
    enabled: !!founderId,
  });
}

export function usePendingWithdrawals() {
  return useQuery({
    queryKey: queryKeys.pendingWithdrawals,
    queryFn: async () => {
      const { getPendingWithdrawals } = await import("@/services/withdrawalService");
      return getPendingWithdrawals();
    },
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Withdrawal, "id" | "createdAt" | "status">) => {
      const { createWithdrawal } = await import("@/services/withdrawalService");
      return createWithdrawal(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingWithdrawals });
      // Also invalidate expenses since withdrawal creates an expense
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses });
      queryClient.invalidateQueries({ queryKey: queryKeys.thisMonthExpenses });
    },
  });
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      withdrawalId,
      approvedBy,
    }: {
      withdrawalId: string;
      approvedBy: string;
    }) => {
      const { approveWithdrawal } = await import("@/services/withdrawalService");
      return approveWithdrawal(withdrawalId, approvedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingWithdrawals });
    },
  });
}

// ============================================
// Repayment Hooks
// ============================================
export function useRepayments() {
  return useQuery({
    queryKey: queryKeys.repayments,
    queryFn: async () => {
      const { getAllRepayments } = await import("@/services/repaymentService");
      return getAllRepayments();
    },
  });
}

export function useRepaymentsByFounder(founderId: string) {
  return useQuery({
    queryKey: queryKeys.repaymentsByFounder(founderId),
    queryFn: async () => {
      const { getRepaymentsByFounder } = await import("@/services/repaymentService");
      return getRepaymentsByFounder(founderId);
    },
    enabled: !!founderId,
  });
}

export function useCreateRepayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Repayment, "id" | "createdAt">) => {
      const { createRepayment } = await import("@/services/repaymentService");
      return createRepayment(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repayments });
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals });
      queryClient.invalidateQueries({ queryKey: queryKeys.founderFinances });
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSummary });
    },
  });
}

// ============================================
// Notes Hooks
// ============================================
export function useNotes() {
  return useQuery({
    queryKey: queryKeys.notes,
    queryFn: async () => {
      const { getAllNotes } = await import("@/services/noteService");
      return getAllNotes();
    },
  });
}

export function useNote(noteId: string) {
  return useQuery({
    queryKey: queryKeys.note(noteId),
    queryFn: async () => {
      const { getNoteById } = await import("@/services/noteService");
      return getNoteById(noteId);
    },
    enabled: !!noteId,
  });
}

export function usePinnedNotes() {
  return useQuery({
    queryKey: queryKeys.pinnedNotes,
    queryFn: async () => {
      const { getPinnedNotes } = await import("@/services/noteService");
      return getPinnedNotes();
    },
  });
}

export function useNotesByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.notesByProject(projectId),
    queryFn: async () => {
      const { getNotesByProject } = await import("@/services/noteService");
      return getNotesByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useNotesByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.notesByClient(clientId),
    queryFn: async () => {
      const { getNotesByClient } = await import("@/services/noteService");
      return getNotesByClient(clientId);
    },
    enabled: !!clientId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Note, "id" | "createdAt" | "updatedAt" | "checkpoints"> & {
        checkpoints?: { text: string; isChecked: boolean }[];
      }
    ) => {
      const { createNote } = await import("@/services/noteService");
      const noteId = await createNote(data);
      // Log activity
      const { logNoteCreated } = await import("@/services/activityLogService");
      await logNoteCreated(data.createdBy, noteId, data.title, data.isPinned);
      return noteId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs });
    },
  });
}

export function useToggleCheckpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      checkpointId,
      isChecked,
    }: {
      noteId: string;
      checkpointId: string;
      isChecked: boolean;
    }) => {
      const { toggleCheckpoint } = await import("@/services/noteService");
      return toggleCheckpoint(noteId, checkpointId, isChecked);
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
}

export function useToggleNotePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, isPinned, userId, noteTitle }: { noteId: string; isPinned: boolean; userId?: string; noteTitle?: string }) => {
      const { toggleNotePin } = await import("@/services/noteService");
      await toggleNotePin(noteId, isPinned);
      // Log activity if userId provided
      if (userId && noteTitle) {
        const { logNotePinned } = await import("@/services/activityLogService");
        await logNotePinned(userId, noteId, noteTitle, isPinned);
      }
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      data,
      userId,
      noteTitle,
    }: {
      noteId: string;
      data: Partial<{ title: string; content: string; isPinned: boolean; projectId: string; clientId: string }>;
      userId?: string;
      noteTitle?: string;
    }) => {
      const { updateNote } = await import("@/services/noteService");
      await updateNote(noteId, data);
      // Log activity if userId provided
      if (userId && noteTitle) {
        const { logNoteUpdated } = await import("@/services/activityLogService");
        await logNoteUpdated(userId, noteId, noteTitle);
      }
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLogs });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { deleteNote } = await import("@/services/noteService");
      await deleteNote(noteId);
      // Note: We intentionally don't log delete actions to keep activity feed clean
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
}

export function useAddCheckpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, text }: { noteId: string; text: string }) => {
      const { addCheckpoint } = await import("@/services/noteService");
      return addCheckpoint(noteId, text);
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.note(noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });
}

// ============================================
// Document Hooks
// ============================================
export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: async () => {
      const { getAllDocuments } = await import("@/services/documentService");
      return getAllDocuments();
    },
  });
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: queryKeys.document(documentId),
    queryFn: async () => {
      const { getDocumentById } = await import("@/services/documentService");
      return getDocumentById(documentId);
    },
    enabled: !!documentId,
  });
}

export function useDocumentsByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.documentsByProject(projectId),
    queryFn: async () => {
      const { getDocumentsByProject } = await import("@/services/documentService");
      return getDocumentsByProject(projectId);
    },
    enabled: !!projectId,
  });
}

export function useDocumentsByClient(clientId: string) {
  return useQuery({
    queryKey: queryKeys.documentsByClient(clientId),
    queryFn: async () => {
      const { getDocumentsByClient } = await import("@/services/documentService");
      return getDocumentsByClient(clientId);
    },
    enabled: !!clientId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Document, "id" | "createdAt" | "updatedAt">) => {
      const { createDocumentRecord } = await import("@/services/documentService");
      return createDocumentRecord(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

// ============================================
// Activity Log Hooks
// ============================================
export function useRecentActivityLogs(count: number = 20) {
  return useQuery({
    queryKey: queryKeys.recentActivityLogs(count),
    queryFn: async () => {
      const { getRecentActivityLogs } = await import("@/services/activityLogService");
      return getRecentActivityLogs(count);
    },
  });
}

export function useActivityLogsByUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.activityLogsByUser(userId),
    queryFn: async () => {
      const { getActivityLogsByUser } = await import("@/services/activityLogService");
      return getActivityLogsByUser(userId);
    },
    enabled: !!userId,
  });
}

export function useInternActivityLogs() {
  return useQuery({
    queryKey: [...queryKeys.activityLogs, "interns"],
    queryFn: async () => {
      const { getInternActivityLogs } = await import("@/services/activityLogService");
      return getInternActivityLogs();
    },
  });
}

// ============================================
// Settings Hooks
// ============================================
export function useCompanySettings() {
  return useQuery({
    queryKey: queryKeys.companySettings,
    queryFn: async () => {
      const { getCompanySettings } = await import("@/services/settingsService");
      return getCompanySettings();
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Omit<CompanySettings, "updatedAt">>) => {
      const { updateCompanySettings } = await import("@/services/settingsService");
      return updateCompanySettings(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySettings });
    },
  });
}

// Aliases for Settings
export const useSettings = useCompanySettings;
export const useUpdateSettings = useUpdateCompanySettings;

// ============================================
// User Profile Update Hook
// ============================================
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<{ name: string; phone: string; avatar: string }>;
    }) => {
      const { updateUserProfile } = await import("@/services/userService");
      return updateUserProfile(userId, data);
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.founders });
    },
  });
}

// ============================================
// Re-export Real-time Hooks
// ============================================
export {
  // Real-time collection/document hooks
  useRealtimeCollection,
  useRealtimeDocument,
  // Real-time Client hooks
  useRealtimeClients,
  useRealtimeClient,
  useRealtimeClientsByStatus,
  // Real-time Project hooks
  useRealtimeProjects,
  useRealtimeProject,
  useRealtimeProjectsByClient,
  useRealtimeProjectsByStatus,
  // Real-time Invoice hooks
  useRealtimeInvoices,
  useRealtimeInvoice,
  useRealtimeInvoicesByClient,
  // Real-time Expense hooks
  useRealtimeExpenses,
  // Real-time Withdrawal hooks
  useRealtimeWithdrawals,
  useRealtimeWithdrawalsByFounder,
  // Real-time Note hooks
  useRealtimeNotes,
  useRealtimeNote,
  useRealtimeNotesByProject,
  useRealtimeNotesByClient,
  // Real-time Document hooks (Firebase metadata + R2 file URLs)
  useRealtimeDocuments,
  useRealtimeDocumentRecord,
  useRealtimeDocumentsByType,
  useRealtimeDocumentsByProject,
  useRealtimeDocumentsByClient,
  // Utility hooks
  useInvalidateQueries,
} from "./useRealtimeFirestore";
