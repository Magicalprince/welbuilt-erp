// Single source of truth for the Net Profit / Bank Balance formula —
// previously duplicated independently in financeService.ts,
// userService.ts, and ReportsPage.tsx, which could silently drift out of
// sync. Every consumer of these numbers should go through here.

export interface NetProfitInputs {
  totalRevenue: number;
  operationalExpenses: number; // Expenses excluding FOUNDER_WITHDRAWAL
  totalSalary: number; // Sum of all founder "salary taken" records — a
  // separate category from Expenses (never stored in the Expenses
  // collection), but still deducted from what the company has earned.
}

export function calculateNetProfit(inputs: NetProfitInputs): number {
  return inputs.totalRevenue - inputs.operationalExpenses - inputs.totalSalary;
}

export function calculateBankBalance(netProfit: number, totalWithdrawals: number): number {
  return netProfit - totalWithdrawals;
}
