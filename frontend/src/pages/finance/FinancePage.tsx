import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  ArrowRight,
  Plus,
  AlertCircle,
  Banknote,
  PieChart,
  BarChart3,
  ArrowUpRight,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Avatar,
  Progress,
  Badge,
  Skeleton,
  AnimatedCurrency,
  AnimatedPercentage,
  ComparisonAreaChart,
  DonutChart,
  HorizontalBarChart,
  ChartLegend,
  ChartColors,
} from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { useFinancialSummary, useFounderFinances, useInvoices, useClients, useExpenses, useIncomes } from "@/hooks/useFirestore";
import type { InvoiceStatus } from "@/types";
import { Timestamp } from "firebase/firestore";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function FinancePage() {
  const { data: financials, isLoading: loadingFinancials, error: financialsError } = useFinancialSummary();
  const { data: founderFinances, isLoading: loadingFounders } = useFounderFinances();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: clients } = useClients();
  const { data: expenses } = useExpenses();
  const { data: incomes } = useIncomes();

  // Create client name map
  const clientMap = useMemo(() => {
    if (!clients) return {} as Record<string, string>;
    return clients.reduce((acc, client) => {
      acc[client.id] = client.companyName;
      return acc;
    }, {} as Record<string, string>);
  }, [clients]);

  // Get recent invoices (last 5) with client names
  const recentInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.slice(0, 5).map((invoice) => ({
      ...invoice,
      clientName: clientMap[invoice.clientId] || "Unknown Client",
    }));
  }, [invoices, clientMap]);

  // Monthly income vs expenses for chart.
  // Buckets are keyed by year+month (not just month name) so a prior year's
  // "Aug" can never bleed into the current year's "Aug" bucket. Income here
  // comes ONLY from Income records — never from invoice totals — matching
  // the same revenue rule getFinancialSummary()/the Dashboard already use.
  const monthlyComparisonData = useMemo(() => {
    if (!expenses && !incomes) return [];

    const monthlyData: Record<string, { label: string; income: number; expenses: number }> = {};
    const now = new Date();
    const bucketKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyData[bucketKey(d)] = {
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        income: 0,
        expenses: 0,
      };
    }

    incomes?.forEach(inc => {
      const date = inc.date instanceof Timestamp ? inc.date.toDate() : new Date(inc.date);
      const key = bucketKey(date);
      if (monthlyData[key]) {
        monthlyData[key].income += inc.amount;
      }
    });

    expenses?.forEach(exp => {
      const date = exp.date instanceof Timestamp ? exp.date.toDate() : new Date(exp.date);
      const key = bucketKey(date);
      if (monthlyData[key]) {
        monthlyData[key].expenses += exp.amount;
      }
    });

    return Object.values(monthlyData).map(({ label, income, expenses }) => ({
      name: label,
      income,
      expenses,
    }));
  }, [expenses, incomes]);

  // Expense breakdown for donut chart
  const expenseBreakdown = useMemo(() => {
    if (!expenses) return [];

    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const colors = [ChartColors.gold, ChartColors.slate, ChartColors.beige, ChartColors.success, ChartColors.info, "#8B5CF6"];
    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .slice(0, 6);
  }, [expenses]);

  // Founder equity data for horizontal bar chart
  const founderEquityData = useMemo(() => {
    if (!founderFinances) return [];
    return founderFinances.map(f => ({
      name: f.name.split(' ')[0],
      value: f.availableBalance,
      value2: f.totalWithdrawals,
      total: f.earnedShare,
    }));
  }, [founderFinances]);

  // Calculate profit margin
  const profitMargin = useMemo(() => {
    if (!financials?.totalRevenue || financials.totalRevenue === 0) return 0;
    return (financials.netProfit / financials.totalRevenue) * 100;
  }, [financials]);

  if (loadingFinancials || loadingFounders) {
    return <FinancePageSkeleton />;
  }

  if (financialsError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Error loading financial data</h2>
        <p className="text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Finance Overview</h1>
          <p className="text-muted-foreground">Track revenue, expenses, and founder equity</p>
        </div>
        <div className="flex gap-2">
          <Link to="/finance/invoices/new">
            <Button className="bg-brand-gradient hover:opacity-90 text-slate-900 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
          <Link to="/finance/income">
            <Button variant="outline" className="border-primary/30">
              <Plus className="h-4 w-4 mr-2" />
              Add Income
            </Button>
          </Link>
          <Link to="/finance/expenses">
            <Button variant="outline" className="border-primary/30">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Grid - Bento Layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue - Large Card */}
        <motion.div variants={itemVariants} className="lg:col-span-2 lg:row-span-2">
          <Card className="glass-card border-border/50 h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Income vs Expenses
                  </p>
                  <div className="flex items-baseline gap-4 mt-2">
                    <AnimatedCurrency
                      value={financials?.totalRevenue ?? 0}
                      className="text-3xl font-bold text-green-500"
                    />
                    <span className="text-muted-foreground">/</span>
                    <AnimatedCurrency
                      value={financials?.totalExpenses ?? 0}
                      className="text-xl font-semibold text-red-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500">
                  <ArrowUpRight className="h-4 w-4" />
                  <AnimatedPercentage value={profitMargin} className="text-sm font-medium" />
                  <span className="text-xs">margin</span>
                </div>
              </div>
              {monthlyComparisonData.length > 0 && (
                <ComparisonAreaChart data={monthlyComparisonData} height={220} />
              )}
              <ChartLegend
                items={[
                  { name: "Income", color: ChartColors.success },
                  { name: "Expenses", color: "#EF4444" },
                ]}
                className="mt-4 justify-center"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Net Profit */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Net Profit
                  </p>
                  <AnimatedCurrency
                    value={financials?.netProfit ?? 0}
                    className="text-2xl font-bold mt-2 text-green-500"
                  />
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                After all expenses
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Company Balance */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Bank Balance
                  </p>
                  <AnimatedCurrency
                    value={financials?.bankBalance ?? 0}
                    className="text-2xl font-bold mt-2 text-purple-500"
                  />
                </div>
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-purple-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                After {formatCurrency(financials?.totalWithdrawals ?? 0)} withdrawn
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Payments */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Pending Payments
                  </p>
                  <AnimatedCurrency
                    value={financials?.pendingPayments ?? 0}
                    className="text-2xl font-bold mt-2 text-amber-500"
                  />
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <Link to="/finance/invoices" className="text-xs text-primary hover:underline mt-3 inline-block">
                View unpaid invoices
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Breakdown Donut */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full">
            <CardContent className="p-6">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Expense Categories
              </p>
              {expenseBreakdown.length > 0 ? (
                <>
                  <DonutChart
                    data={expenseBreakdown}
                    height={140}
                    innerRadius={32}
                    outerRadius={50}
                    centerValue={expenseBreakdown.length.toString()}
                  />
                </>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
                  No expense data
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Founder Equity Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Founder Equity Breakdown
          </h2>
          <Link to="/finance/withdrawals">
            <Button variant="ghost" size="sm" className="text-primary">
              Record Withdrawal
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Founder Cards */}
          <div className="lg:col-span-2 grid gap-4 md:grid-cols-3">
            {founderFinances && founderFinances.length > 0 ? (
              founderFinances.map((founder, index) => (
                <FounderCard key={founder.id} founder={founder} index={index} />
              ))
            ) : (
              <Card className="md:col-span-3 glass-card">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>No founder data available. Please set up founders first.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Equity Distribution Chart */}
          {founderEquityData.length > 0 && (
            <Card className="glass-card border-border/50">
              <CardContent className="p-6">
                <p className="text-sm font-medium mb-4">Available vs Withdrawn</p>
                <HorizontalBarChart data={founderEquityData} height={180} />
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>

      {/* Quick Actions & Recent Invoices */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to="/finance/invoices">
              <QuickActionCard icon={Receipt} label="Invoices" color="gold" />
            </Link>
            <Link to="/finance/income">
              <QuickActionCard icon={Banknote} label="Income" color="success" />
            </Link>
            <Link to="/finance/expenses">
              <QuickActionCard icon={TrendingDown} label="Expenses" color="danger" />
            </Link>
            <Link to="/finance/withdrawals">
              <QuickActionCard icon={Wallet} label="Withdrawals" color="purple" />
            </Link>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <Link to="/finance/invoices">
              <Button variant="ghost" size="sm" className="text-primary">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingInvoices ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentInvoices.length > 0 ? (
              recentInvoices.map((invoice) => (
                <Link key={invoice.id} to={`/finance/invoices/${invoice.id}`}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-all border border-transparent hover:border-border/50"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.clientName || "Client"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                      <InvoiceStatusBadge status={invoice.status} />
                    </div>
                  </motion.div>
                </Link>
              ))
            ) : (
              <p className="text-center py-4 text-muted-foreground">
                No invoices yet
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Founder Card Component
function FounderCard({ founder, index }: { founder: { id: string; name: string; equityPercent: number; earnedShare: number; totalWithdrawals: number; availableBalance: number }; index: number }) {
  const colors = [
    { bg: "bg-amber-500", ring: "ring-amber-500/20", text: "text-amber-500" },
    { bg: "bg-slate-500", ring: "ring-slate-500/20", text: "text-slate-500" },
    { bg: "bg-emerald-500", ring: "ring-emerald-500/20", text: "text-emerald-500" },
  ];
  const color = colors[index % colors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="glass-card border-border/50 card-hover h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`ring-2 ${color.ring} rounded-full`}>
              <Avatar name={founder.name} size="sm" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{founder.name}</p>
              <Badge variant="secondary" className="text-xs">{founder.equityPercent}%</Badge>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Earned</span>
              <span className="font-medium">{formatCurrency(founder.earnedShare)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Withdrawn</span>
              <span className="font-medium text-red-500">-{formatCurrency(founder.totalWithdrawals)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="font-medium">Available</span>
              <span className="font-bold text-green-500">{formatCurrency(founder.availableBalance)}</span>
            </div>
          </div>
          <Progress
            value={founder.earnedShare > 0 ? (founder.totalWithdrawals / founder.earnedShare) * 100 : 0}
            className="mt-3 h-1.5"
            indicatorClassName={color.bg}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Quick Action Card
function QuickActionCard({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    gold: { bg: "bg-amber-500/10", text: "text-amber-500" },
    success: { bg: "bg-green-500/10", text: "text-green-500" },
    danger: { bg: "bg-red-500/10", text: "text-red-500" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-500" },
  };
  const colors = colorMap[color] || colorMap.gold;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all text-center cursor-pointer"
    >
      <div className={`h-10 w-10 mx-auto mb-2 rounded-lg ${colors.bg} flex items-center justify-center transition-colors group-hover:scale-110`}>
        <Icon className={`h-5 w-5 ${colors.text}`} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </motion.div>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
    DRAFT: { label: "Draft", variant: "secondary" },
    PENDING: { label: "Pending", variant: "warning" },
    PAID: { label: "Paid", variant: "success" },
    PARTIAL: { label: "Partial", variant: "default" },
    OVERDUE: { label: "Overdue", variant: "destructive" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
  };
  return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
}

function FinancePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="lg:col-span-2 lg:row-span-2 h-80" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>

      <div>
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
