import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  GraduationCap,
  Calendar,
  IndianRupee,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Badge,
} from "@/components/ui";
import { useExpenses, useIncomes, useInvoices, useClients, useProjects } from "@/hooks/useFirestore";
import { useQuery } from "@tanstack/react-query";
import { getInterns } from "@/services/internService";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => ({
  value: y.toString(),
  label: y.toString(),
}));

type ReportTab = "pnl" | "clients" | "interns" | "invoices";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("pnl");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth()).toString());

  const { data: expenses } = useExpenses();
  const { data: incomes } = useIncomes();
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: interns } = useQuery({ queryKey: ["interns"], queryFn: getInterns });

  // ── P&L Data ──────────────────────────────────────────────
  const pnlMonthly = useMemo(() => {
    const year = parseInt(selectedYear);
    return MONTHS.map((month, idx) => {
      const monthIncome = (incomes || [])
        .filter((i) => {
          const d = new Date(i.date);
          return d.getFullYear() === year && d.getMonth() === idx;
        })
        .reduce((s, i) => s + i.amount, 0);

      const monthExpense = (expenses || [])
        .filter((e) => {
          const d = new Date(e.date);
          return d.getFullYear() === year && d.getMonth() === idx && e.category !== "FOUNDER_WITHDRAWAL";
        })
        .reduce((s, e) => s + e.amount, 0);

      return { month, income: monthIncome, expense: monthExpense, profit: monthIncome - monthExpense };
    });
  }, [incomes, expenses, selectedYear]);

  const pnlTotals = useMemo(() => {
    const totals = pnlMonthly.reduce(
      (acc, m) => ({ income: acc.income + m.income, expense: acc.expense + m.expense, profit: acc.profit + m.profit }),
      { income: 0, expense: 0, profit: 0 }
    );
    return totals;
  }, [pnlMonthly]);

  // ── Client Revenue ─────────────────────────────────────────
  const clientRevenue = useMemo(() => {
    if (!clients || !incomes) return [];
    return clients
      .map((c) => {
        const revenue = incomes.filter((i) => i.clientId === c.id).reduce((s, i) => s + i.amount, 0);
        const projectCount = (projects || []).filter((p) => p.clientId === c.id).length;
        const invoiceCount = (invoices || []).filter((i) => i.clientId === c.id).length;
        return { id: c.id, name: c.companyName, revenue, projectCount, invoiceCount, status: c.status };
      })
      .filter((c) => c.revenue > 0 || c.projectCount > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [clients, incomes, projects, invoices]);

  // ── Intern Summary ─────────────────────────────────────────
  const internSummary = useMemo(() => {
    if (!interns) return { total: 0, paid: 0, unpaid: 0, domains: {} as Record<string, number>, totalStipend: 0 };
    const domains: Record<string, number> = {};
    let totalStipend = 0;
    interns.forEach((i) => {
      domains[i.domain] = (domains[i.domain] || 0) + 1;
      totalStipend += i.stipend || 0;
    });
    return {
      total: interns.length,
      paid: interns.filter((i) => i.paymentStatus === "PAID").length,
      unpaid: interns.filter((i) => i.paymentStatus === "UNPAID").length,
      domains,
      totalStipend,
    };
  }, [interns]);

  // ── Invoice Summary ────────────────────────────────────────
  const invoiceSummary = useMemo(() => {
    if (!invoices) return { total: 0, paid: 0, pending: 0, overdue: 0, totalValue: 0, paidValue: 0 };
    return {
      total: invoices.length,
      paid: invoices.filter((i) => i.status === "PAID").length,
      pending: invoices.filter((i) => i.status === "PENDING" || i.status === "PARTIAL").length,
      overdue: invoices.filter((i) => i.status === "OVERDUE").length,
      totalValue: invoices.reduce((s, i) => s + i.total, 0),
      paidValue: invoices.reduce((s, i) => s + i.paidAmount, 0),
    };
  }, [invoices]);

  // ── Month P&L Detail ───────────────────────────────────────
  const monthIdx = parseInt(selectedMonth);
  const monthDetail = useMemo(() => {
    const year = parseInt(selectedYear);
    const monthIncome = (incomes || []).filter((i) => {
      const d = new Date(i.date);
      return d.getFullYear() === year && d.getMonth() === monthIdx;
    });
    const monthExpenses = (expenses || []).filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === monthIdx && e.category !== "FOUNDER_WITHDRAWAL";
    });
    return { income: monthIncome, expenses: monthExpenses };
  }, [incomes, expenses, selectedYear, selectedMonth]);

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: "pnl", label: "P&L Report", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "clients", label: "Client Revenue", icon: <Users className="h-4 w-4" /> },
    { id: "interns", label: "Intern Summary", icon: <GraduationCap className="h-4 w-4" /> },
    { id: "invoices", label: "Invoice Report", icon: <FileText className="h-4 w-4" /> },
  ];

  const exportCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPnL = () => {
    const rows = [
      ["Month", "Income (₹)", "Expenses (₹)", "Net Profit (₹)"],
      ...pnlMonthly.map((m) => [m.month, m.income.toString(), m.expense.toString(), m.profit.toString()]),
      ["TOTAL", pnlTotals.income.toString(), pnlTotals.expense.toString(), pnlTotals.profit.toString()],
    ];
    exportCSV(`PnL_Report_${selectedYear}.csv`, rows);
  };

  const exportClients = () => {
    const rows = [
      ["Client", "Status", "Revenue (₹)", "Projects", "Invoices"],
      ...clientRevenue.map((c) => [c.name, c.status, c.revenue.toString(), c.projectCount.toString(), c.invoiceCount.toString()]),
    ];
    exportCSV("Client_Revenue_Report.csv", rows);
  };

  const exportInterns = () => {
    if (!interns) return;
    const rows = [
      ["Intern ID", "Name", "College", "Domain", "Duration", "Start Date", "End Date", "Stipend (₹)", "Payment Status"],
      ...interns.map((i) => [
        i.internId, i.name, i.college, i.domain, i.duration,
        formatDate(i.startDate), formatDate(i.endDate),
        (i.stipend || 0).toString(), i.paymentStatus,
      ]),
    ];
    exportCSV("Intern_Summary_Report.csv", rows);
  };

  const exportInvoices = () => {
    if (!invoices || !clients) return;
    const clientMap: Record<string, string> = {};
    clients.forEach((c) => { clientMap[c.id] = c.companyName; });
    const rows = [
      ["Invoice #", "Client", "Total (₹)", "Paid (₹)", "Status", "Issue Date", "Due Date"],
      ...invoices.map((i) => [
        i.invoiceNumber, clientMap[i.clientId] || i.clientId,
        i.total.toString(), i.paidAmount.toString(), i.status,
        formatDate(i.issueDate), formatDate(i.dueDate),
      ]),
    ];
    exportCSV("Invoice_Report.csv", rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Financial and operational reports for WelBuilt AI Solutions</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-muted rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L Report */}
      {activeTab === "pnl" && (
        <motion.div key="pnl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              options={YEAR_OPTIONS}
              className="w-32"
            />
            <Button variant="outline" size="sm" onClick={exportPnL}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Annual Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(pnlTotals.income)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(pnlTotals.expense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <IndianRupee className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Net Profit</span>
                </div>
                <p className={cn("text-2xl font-bold", pnlTotals.profit >= 0 ? "text-primary" : "text-destructive")}>
                  {formatCurrency(pnlTotals.profit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Table */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown — {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Month</th>
                      <th className="p-3 text-right font-medium text-green-600">Income</th>
                      <th className="p-3 text-right font-medium text-red-600">Expenses</th>
                      <th className="p-3 text-right font-medium">Net Profit</th>
                      <th className="p-3 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlMonthly.map((m) => (
                      <tr key={m.month} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{m.month}</td>
                        <td className="p-3 text-right text-green-600">
                          {m.income > 0 ? formatCurrency(m.income) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-right text-red-600">
                          {m.expense > 0 ? formatCurrency(m.expense) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={cn("p-3 text-right font-medium", m.profit >= 0 ? "text-foreground" : "text-destructive")}>
                          {m.income > 0 || m.expense > 0 ? formatCurrency(m.profit) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-right">
                          {m.income > 0 ? (
                            <span className={cn("text-xs font-medium", (m.profit / m.income) >= 0 ? "text-green-600" : "text-red-600")}>
                              {((m.profit / m.income) * 100).toFixed(1)}%
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 font-bold bg-muted/30">
                    <tr>
                      <td className="p-3">Total</td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(pnlTotals.income)}</td>
                      <td className="p-3 text-right text-red-600">{formatCurrency(pnlTotals.expense)}</td>
                      <td className={cn("p-3 text-right", pnlTotals.profit >= 0 ? "" : "text-destructive")}>
                        {formatCurrency(pnlTotals.profit)}
                      </td>
                      <td className="p-3 text-right">
                        {pnlTotals.income > 0 && (
                          <span className={cn("text-sm", pnlTotals.profit >= 0 ? "text-green-600" : "text-red-600")}>
                            {((pnlTotals.profit / pnlTotals.income) * 100).toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Month Detail */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Month Detail</CardTitle>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
                  className="w-40"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2">Income ({monthDetail.income.length} entries)</h4>
                  {monthDetail.income.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No income this month</p>
                  ) : (
                    <div className="space-y-2">
                      {monthDetail.income.map((i) => (
                        <div key={i.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">{i.description}</span>
                          <span className="font-medium text-green-600">{formatCurrency(i.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold border-t pt-1">
                        <span>Total</span>
                        <span className="text-green-600">{formatCurrency(monthDetail.income.reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">Expenses ({monthDetail.expenses.length} entries)</h4>
                  {monthDetail.expenses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No expenses this month</p>
                  ) : (
                    <div className="space-y-2">
                      {monthDetail.expenses.map((e) => (
                        <div key={e.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">{e.description}</span>
                          <span className="font-medium text-red-600">{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold border-t pt-1">
                        <span>Total</span>
                        <span className="text-red-600">{formatCurrency(monthDetail.expenses.reduce((s, e) => s + e.amount, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Client Revenue */}
      {activeTab === "clients" && (
        <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportClients}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Client Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {clientRevenue.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">No client revenue data found. Add income entries linked to clients.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Client</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Revenue</th>
                      <th className="p-3 text-right font-medium">Projects</th>
                      <th className="p-3 text-right font-medium">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientRevenue.map((c) => (
                      <tr key={c.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{c.name}</td>
                        <td className="p-3">
                          <Badge variant={c.status === "ACTIVE" ? "success" : "secondary"} className="text-xs">
                            {c.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium text-green-600">{formatCurrency(c.revenue)}</td>
                        <td className="p-3 text-right">{c.projectCount}</td>
                        <td className="p-3 text-right">{c.invoiceCount}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-bold bg-muted/30">
                      <td className="p-3">Total</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(clientRevenue.reduce((s, c) => s + c.revenue, 0))}</td>
                      <td className="p-3 text-right">{clientRevenue.reduce((s, c) => s + c.projectCount, 0)}</td>
                      <td className="p-3 text-right">{clientRevenue.reduce((s, c) => s + c.invoiceCount, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Intern Summary */}
      {activeTab === "interns" && (
        <motion.div key="interns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportInterns}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Interns", value: internSummary.total, color: "text-foreground" },
              { label: "Paid", value: internSummary.paid, color: "text-green-600" },
              { label: "Unpaid", value: internSummary.unpaid, color: "text-red-600" },
              { label: "Total Stipend", value: formatCurrency(internSummary.totalStipend), color: "text-primary" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Domain Breakdown */}
          <Card>
            <CardHeader><CardTitle>Domain Distribution</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(internSummary.domains).length === 0 ? (
                <p className="text-muted-foreground text-sm">No intern data</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(internSummary.domains)
                    .sort((a, b) => b[1] - a[1])
                    .map(([domain, count]) => (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-sm min-w-[160px]">{domain}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(count / internSummary.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Intern Table */}
          <Card>
            <CardHeader><CardTitle>All Interns</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">ID</th>
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">College</th>
                      <th className="p-3 text-left font-medium">Domain</th>
                      <th className="p-3 text-left font-medium">Duration</th>
                      <th className="p-3 text-right font-medium">Stipend</th>
                      <th className="p-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(interns || []).map((i) => (
                      <tr key={i.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{i.internId}</td>
                        <td className="p-3 font-medium">{i.name}</td>
                        <td className="p-3 text-muted-foreground">{i.college}</td>
                        <td className="p-3">{i.domain}</td>
                        <td className="p-3">{i.duration}</td>
                        <td className="p-3 text-right">{i.stipend ? formatCurrency(i.stipend) : "—"}</td>
                        <td className="p-3">
                          <Badge variant={i.paymentStatus === "PAID" ? "success" : "secondary"} className="text-xs">
                            {i.paymentStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Invoice Report */}
      {activeTab === "invoices" && (
        <motion.div key="invoices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={exportInvoices}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Invoices", value: invoiceSummary.total, color: "text-foreground" },
              { label: "Paid", value: invoiceSummary.paid, color: "text-green-600" },
              { label: "Pending", value: invoiceSummary.pending, color: "text-yellow-600" },
              { label: "Overdue", value: invoiceSummary.overdue, color: "text-red-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-2xl font-bold">{formatCurrency(invoiceSummary.totalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(invoiceSummary.paidValue)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Invoice #</th>
                      <th className="p-3 text-left font-medium">Client</th>
                      <th className="p-3 text-right font-medium">Total</th>
                      <th className="p-3 text-right font-medium">Paid</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices || []).map((inv) => {
                      const clientName = clients?.find((c) => c.id === inv.clientId)?.companyName || inv.clientId;
                      return (
                        <tr key={inv.id} className="border-t hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                          <td className="p-3">{clientName}</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(inv.total)}</td>
                          <td className="p-3 text-right text-green-600">{formatCurrency(inv.paidAmount)}</td>
                          <td className="p-3">
                            <Badge
                              variant={
                                inv.status === "PAID" ? "success" :
                                inv.status === "OVERDUE" ? "destructive" :
                                inv.status === "PARTIAL" ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
