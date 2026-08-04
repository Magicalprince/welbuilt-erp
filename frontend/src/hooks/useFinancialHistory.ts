import { useMemo } from "react";
import { useExpenses, useIncomes } from "./useFirestore";

export interface MonthlyFinancialPoint {
  key: string; // "YYYY-M", sortable, unique across years
  year: number;
  month: number; // 0-11
  name: string; // short label, e.g. "Aug" or "Aug '25" when year differs from current
  income: number;
  expenses: number;
}

// Single source of truth for month-bucketed income/expense history, keyed
// by year+month (never just month name) so data from different years can
// never collide into the same bucket. Income is summed from Income records
// ONLY — never from invoice totals — matching the rule getFinancialSummary()
// already enforces (see commit cab91be). Covers the full history from the
// earliest Income or Expense record onward, with no fixed lookback cap, so
// the underlying series keeps growing correctly for as long as the app runs.
export function useFinancialHistory() {
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const { data: incomes, isLoading: loadingIncomes } = useIncomes();

  const fullHistory = useMemo<MonthlyFinancialPoint[]>(() => {
    if (!expenses && !incomes) return [];

    const buckets: Record<string, MonthlyFinancialPoint> = {};

    // Every label always carries its year (e.g. "Aug '26") — history can
    // span many years, so two different Augusts must never look identical.
    const bucketFor = (date: Date): MonthlyFinancialPoint => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!buckets[key]) {
        const label = date.toLocaleDateString("en-US", { month: "short" });
        buckets[key] = {
          key,
          year: date.getFullYear(),
          month: date.getMonth(),
          name: `${label} '${String(date.getFullYear()).slice(2)}`,
          income: 0,
          expenses: 0,
        };
      }
      return buckets[key];
    };

    incomes?.forEach((inc) => {
      const date = inc.date instanceof Date ? inc.date : new Date(inc.date);
      if (isNaN(date.getTime())) return;
      bucketFor(date).income += inc.amount;
    });

    expenses?.forEach((exp) => {
      const date = exp.date instanceof Date ? exp.date : new Date(exp.date);
      if (isNaN(date.getTime())) return;
      bucketFor(date).expenses += exp.amount;
    });

    return Object.values(buckets).sort((a, b) => a.year - b.year || a.month - b.month);
  }, [expenses, incomes]);

  // Recent window (last 6 calendar months, always including the current
  // month even if it has no data yet) for the small inline chart. Always
  // 6 real calendar months so it's unambiguous without a year — unlike
  // fullHistory's labels, which must disambiguate across years.
  const recentHistory = useMemo<MonthlyFinancialPoint[]>(() => {
    const now = new Date();
    const byKey = new Map(fullHistory.map((p) => [p.key, p]));
    const points: MonthlyFinancialPoint[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = byKey.get(key);
      points.push({
        key,
        year: d.getFullYear(),
        month: d.getMonth(),
        name: d.toLocaleDateString("en-US", { month: "short" }),
        income: existing?.income ?? 0,
        expenses: existing?.expenses ?? 0,
      });
    }

    return points;
  }, [fullHistory]);

  return {
    fullHistory,
    recentHistory,
    isLoading: loadingExpenses || loadingIncomes,
  };
}
