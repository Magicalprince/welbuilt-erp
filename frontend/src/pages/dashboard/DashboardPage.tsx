import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  FolderKanban,
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Clock,
  Loader2,
  Database,
  BarChart3,
  PieChart,
  ArrowUpRight,
  Banknote,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Progress,
  Avatar,
  Skeleton,
  AnimatedCurrency,
  AnimatedNumber,
  RevenueAreaChart,
  DonutChart,
  Sparkline,
  ChartColors,
} from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/lib/utils";
import {
  useActiveProjectsCount,
  useActiveClientsCount,
  useFinancialSummary,
  useFounderFinances,
  useRecentActivityLogs,
  useInvoices,
  useExpenses,
  useIncomes,
} from "@/hooks/useFirestore";
import { useQueryClient } from "@tanstack/react-query";
import type { FounderFinance, Invoice, ActivityLog } from "@/types";
import toast from "react-hot-toast";

// Founder configuration for initialization
const FOUNDERS_CONFIG = [
  {
    name: "Ramachandraa PS",
    email: "mail2ramachandraa@gmail.com",
    equityPercent: 34,
    role: "FOUNDER" as const,
  },
  {
    name: "Rohith Babu ME",
    email: "rohithbabu031@gmail.com",
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
  {
    name: "Baranitharan S",
    email: "iambarani.45@gmail.com",
    equityPercent: 33,
    role: "FOUNDER" as const,
  },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [greeting, setGreeting] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch data from Firestore
  const { data: activeProjects, isLoading: loadingProjects } = useActiveProjectsCount();
  const { data: activeClients, isLoading: loadingClients } = useActiveClientsCount();
  const { data: financialSummary, isLoading: loadingFinance } = useFinancialSummary();
  const { data: founderFinances, isLoading: loadingFounders } = useFounderFinances();
  const { data: recentActivity, isLoading: loadingActivity } = useRecentActivityLogs(10);
  const { data: invoices } = useInvoices();
  const { data: expenses } = useExpenses();
  const { data: incomes } = useIncomes();

  // Calculate monthly revenue data for chart.
  // Revenue comes ONLY from Income records — never from invoice totals —
  // matching the rule getFinancialSummary()/getTotalRevenue() already
  // enforce everywhere else (see commit cab91be). Adding paid-invoice
  // totals here as well would double-count revenue that was also logged
  // as Income.
  const monthlyRevenueData = useMemo(() => {
    // Use year-month key for reliable matching
    const monthlyData: Record<string, { value: number; date: Date; display: string }> = {};

    // Helper to safely parse date with multiple fallbacks
    const parseDate = (dateValue: unknown): Date | null => {
      if (!dateValue) return null;

      // Handle Firestore Timestamp
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        return (dateValue as Timestamp).toDate();
      }

      // Handle Date object
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }

      // Handle string or number
      if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      // Handle object with seconds (Firestore Timestamp-like)
      if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        const seconds = (dateValue as { seconds: number }).seconds;
        return new Date(seconds * 1000);
      }

      return null;
    };

    // Helper to add to monthly data
    const addToMonth = (date: Date, amount: number) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!monthlyData[key]) {
        monthlyData[key] = {
          value: 0,
          date: new Date(date.getFullYear(), date.getMonth(), 1),
          display: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        };
      }
      monthlyData[key].value += amount;
    };

    // Add revenue from incomes collection
    incomes?.forEach(inc => {
      const incomeDate = parseDate(inc.date);
      if (incomeDate && inc.amount) {
        addToMonth(incomeDate, inc.amount);
      }
    });

    // If we have any data, show it sorted by date
    const entries = Object.entries(monthlyData);
    if (entries.length > 0) {
      // Sort by date and take last 6 months with data
      const sortedData = entries
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .slice(-6)
        .map(([, data]) => ({ name: data.display, value: data.value }));
      return sortedData;
    }

    // Fallback: return last 6 months with zeros if no data
    const now = new Date();
    const fallbackData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      fallbackData.push({
        name: d.toLocaleDateString('en-US', { month: 'short' }),
        value: 0
      });
    }
    return fallbackData;
  }, [incomes]);

  // Expense breakdown for donut chart
  const expenseBreakdown = useMemo(() => {
    if (!expenses) return [];

    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const colors = [ChartColors.gold, ChartColors.slate, ChartColors.beige, ChartColors.success, ChartColors.info];
    return Object.entries(categoryTotals)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .slice(0, 5);
  }, [expenses]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  // Initialize founder data
  const handleInitializeData = async () => {
    if (!user?.id) {
      toast.error("Please log in first");
      return;
    }

    setIsInitializing(true);
    try {
      // 1. Initialize company settings
      const settingsRef = doc(db, "settings", "company");
      const existingSettings = await getDoc(settingsRef);

      if (!existingSettings.exists()) {
        await setDoc(settingsRef, {
          companyName: "WelBuilt AI Solutions",
          companyEmail: "contact@welbuilt.ai",
          companyAddress: "",
          companyPhone: "",
          gstNumber: "",
          invoicePrefix: "INV",
          quotationPrefix: "QUO",
          currency: "INR",
          currencySymbol: "₹",
          dateFormat: "DD/MM/YYYY",
          fiscalYearStart: 4,
          bankDetails: {
            bankName: "",
            accountNumber: "",
            ifscCode: "",
            accountHolderName: "WelBuilt AI Solutions",
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      // 2. Update current user's data to be a founder
      const currentFounder = FOUNDERS_CONFIG.find(f => f.email === user.email);
      if (currentFounder) {
        const userRef = doc(db, "users", user.id);
        await setDoc(userRef, {
          id: user.id,
          name: currentFounder.name,
          email: currentFounder.email,
          equityPercent: currentFounder.equityPercent,
          role: currentFounder.role,
          phone: "",
          avatar: "",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }

      // 3. Create placeholder entries for other founders
      for (const founder of FOUNDERS_CONFIG) {
        if (founder.email !== user.email) {
          const placeholderId = `placeholder_${founder.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const placeholderRef = doc(db, "users", placeholderId);
          const existingPlaceholder = await getDoc(placeholderRef);

          if (!existingPlaceholder.exists()) {
            await setDoc(placeholderRef, {
              id: placeholderId,
              name: founder.name,
              email: founder.email,
              equityPercent: founder.equityPercent,
              role: founder.role,
              phone: "",
              avatar: "",
              isPlaceholder: true,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["founders"] });
      queryClient.invalidateQueries({ queryKey: ["founderFinances"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });

      toast.success("Data initialized successfully!");
    } catch (error) {
      console.error("Initialization error:", error);
      toast.error("Failed to initialize data");
    } finally {
      setIsInitializing(false);
    }
  };

  const isLoading = loadingProjects || loadingClients || loadingFinance || loadingFounders;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {greeting}, {user?.name?.split(" ")[0] || "Founder"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/projects/new">
            <Button className="bg-brand-gradient hover:opacity-90 text-slate-900 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
          <Link to="/finance/invoices/new">
            <Button variant="outline" className="border-primary/30 hover:border-primary/50">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Bento Grid - Stats + Chart */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card - Large */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="glass-card border-border/50 overflow-hidden h-full">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Total Revenue
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-10 w-40 mt-2" />
                  ) : (
                    <AnimatedCurrency
                      value={financialSummary?.totalRevenue ?? 0}
                      className="text-3xl font-bold mt-2"
                    />
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    This month: {formatCurrency(financialSummary?.thisMonthRevenue ?? 0)}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="text-sm font-medium">+12%</span>
                </div>
              </div>
              {monthlyRevenueData.length > 0 && (
                <RevenueAreaChart data={monthlyRevenueData} height={180} showGrid={false} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants}>
          <StatCard
            title="Active Projects"
            value={activeProjects ?? 0}
            icon={FolderKanban}
            href="/projects"
            color="gold"
            isLoading={loadingProjects}
            sparklineData={[3, 5, 4, 7, 6, 8, 9]}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <StatCard
            title="Active Clients"
            value={activeClients ?? 0}
            icon={Users}
            href="/clients"
            color="slate"
            isLoading={loadingClients}
            sparklineData={[2, 3, 4, 3, 5, 6, 5]}
          />
        </motion.div>

        {/* Net Profit Card */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Net Profit
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28 mt-2" />
                  ) : (
                    <AnimatedCurrency
                      value={financialSummary?.netProfit ?? 0}
                      className="text-2xl font-bold mt-2 text-green-500"
                    />
                  )}
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Revenue - Expenses
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Payments Card */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Pending Payments
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28 mt-2" />
                  ) : (
                    <AnimatedCurrency
                      value={financialSummary?.pendingPayments ?? 0}
                      className="text-2xl font-bold mt-2 text-amber-500"
                    />
                  )}
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <Link to="/finance" className="text-xs text-primary hover:underline mt-3 inline-block">
                View invoices
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expenses Card */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50 h-full card-hover">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Total Expenses
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28 mt-2" />
                  ) : (
                    <AnimatedCurrency
                      value={financialSummary?.totalExpenses ?? 0}
                      className="text-2xl font-bold mt-2 text-red-500"
                    />
                  )}
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </div>
              <Link to="/finance" className="text-xs text-primary hover:underline mt-3 inline-block">
                View breakdown
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
                Expense Breakdown
              </p>
              {expenseBreakdown.length > 0 ? (
                <DonutChart
                  data={expenseBreakdown}
                  height={150}
                  innerRadius={35}
                  outerRadius={55}
                />
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
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
            Founder Equity
          </h2>
          <Link to="/finance">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View Details
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {loadingFounders ? (
            <>
              <FounderCardSkeleton />
              <FounderCardSkeleton />
              <FounderCardSkeleton />
            </>
          ) : founderFinances && founderFinances.length > 0 ? (
            founderFinances.map((founder, index) => (
              <FounderCard key={founder.id} founder={founder} index={index} />
            ))
          ) : (
            <div className="col-span-3">
              <Card className="glass-card p-6 text-center space-y-4">
                <Database className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">No founder data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click the button below to initialize founder and company data
                  </p>
                </div>
                <Button onClick={handleInitializeData} disabled={isInitializing} className="bg-brand-gradient text-slate-900">
                  {isInitializing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Initialize Data
                    </>
                  )}
                </Button>
              </Card>
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Grid - Activity + Invoices + Actions */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <Link to="/activity" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingActivity ? (
              <>
                <ActivitySkeleton />
                <ActivitySkeleton />
                <ActivitySkeleton />
                <ActivitySkeleton />
              </>
            ) : recentActivity && recentActivity.length > 0 ? (
              recentActivity.slice(0, 4).map((activity, index) => (
                <ActivityItem key={activity.id} activity={activity} index={index} />
              ))
            ) : (
              <div className="text-center py-6">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Recent Invoices
              </CardTitle>
              <Link to="/finance" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {!invoices ? (
              <>
                <InvoiceSkeleton />
                <InvoiceSkeleton />
                <InvoiceSkeleton />
                <InvoiceSkeleton />
              </>
            ) : invoices.length > 0 ? (
              invoices.slice(0, 4).map((invoice, index) => (
                <InvoiceItem key={invoice.id} invoice={invoice} index={index} />
              ))
            ) : (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
                <Link to="/finance/invoices/new">
                  <Button size="sm" variant="outline" className="mt-2">
                    <Plus className="h-3 w-3 mr-1" />
                    Create Invoice
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to="/projects/new">
              <QuickActionButton icon={FolderKanban} label="New Project" color="gold" />
            </Link>
            <Link to="/clients/new">
              <QuickActionButton icon={Users} label="Add Client" color="slate" />
            </Link>
            <Link to="/finance/invoices/new">
              <QuickActionButton icon={Wallet} label="Create Invoice" color="success" />
            </Link>
            <Link to="/notes">
              <QuickActionButton icon={TrendingUp} label="Add Note" color="info" />
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Stat Card Component with Sparkline
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  href: string;
  color: "gold" | "slate" | "success" | "info";
  isLoading?: boolean;
  sparklineData?: number[];
}

function StatCard({ title, value, icon: Icon, href, color, isLoading, sparklineData }: StatCardProps) {
  const colorMap = {
    gold: { bg: "bg-amber-500/10", text: "text-amber-500", sparkColor: "#F5A623" },
    slate: { bg: "bg-slate-500/10", text: "text-slate-500", sparkColor: "#2D4A5E" },
    success: { bg: "bg-green-500/10", text: "text-green-500", sparkColor: "#22C55E" },
    info: { bg: "bg-blue-500/10", text: "text-blue-500", sparkColor: "#3B82F6" },
  };

  const colors = colorMap[color];

  return (
    <Link to={href}>
      <Card className="glass-card border-border/50 card-hover cursor-pointer h-full overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-2" />
              ) : (
                <AnimatedNumber value={value} className="text-2xl font-bold mt-2" />
              )}
            </div>
            <div className={`h-10 w-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${colors.text}`} />
            </div>
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="mt-3 -mb-2 -mx-2">
              <Sparkline data={sparklineData} color={colors.sparkColor} height={40} width={140} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Founder Card Component
interface FounderCardProps {
  founder: FounderFinance;
  index: number;
}

function FounderCard({ founder, index }: FounderCardProps) {
  const colors = [
    { ring: "ring-amber-500/30", gradient: "from-amber-500/20 to-amber-600/10", bg: "bg-amber-500" },
    { ring: "ring-slate-500/30", gradient: "from-slate-500/20 to-slate-600/10", bg: "bg-slate-500" },
    { ring: "ring-emerald-500/30", gradient: "from-emerald-500/20 to-emerald-600/10", bg: "bg-emerald-500" },
  ];

  const color = colors[index % colors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="glass-card border-border/50 card-hover overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`ring-2 ${color.ring} rounded-full p-0.5 bg-gradient-to-br ${color.gradient}`}>
              <Avatar name={founder.name} size="lg" className="ring-0" showRing={false} />
            </div>
            <div>
              <p className="font-semibold">{founder.name}</p>
              <Badge variant="secondary" className="mt-0.5">{founder.equityPercent}% Equity</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Earned Share</span>
              <AnimatedCurrency value={founder.earnedShare} className="font-medium" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Withdrawn</span>
              <span className="font-medium text-red-500">
                -{formatCurrency(founder.totalWithdrawals)}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="font-medium">Available</span>
              <AnimatedCurrency
                value={founder.availableBalance}
                className="font-bold text-lg text-green-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <Progress
              value={founder.earnedShare > 0 ? (founder.totalWithdrawals / founder.earnedShare) * 100 : 0}
              className="h-2"
              indicatorClassName={color.bg}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {founder.earnedShare > 0 ? Math.round((founder.totalWithdrawals / founder.earnedShare) * 100) : 0}% withdrawn
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FounderCardSkeleton() {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
        <Skeleton className="h-2 w-full mt-4" />
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

// Quick Action Button
function QuickActionButton({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    gold: "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20",
    slate: "bg-slate-500/10 text-slate-500 group-hover:bg-slate-500/20",
    success: "bg-green-500/10 text-green-500 group-hover:bg-green-500/20",
    info: "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20",
  };

  return (
    <div className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all cursor-pointer">
      <div className={`h-10 w-10 rounded-lg ${colorMap[color]} flex items-center justify-center transition-colors`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function getActivityColor(entityType: string) {
  switch (entityType) {
    case "INVOICE": return "bg-yellow-500";
    case "CLIENT": return "bg-green-500";
    case "PROJECT": return "bg-blue-500";
    case "WITHDRAWAL": return "bg-pink-500";
    case "EXPENSE": return "bg-red-500";
    case "DOCUMENT": return "bg-purple-500";
    case "INCOME": return "bg-emerald-500";
    case "NOTE": return "bg-orange-500";
    case "USER": return "bg-primary";
    default: return "bg-gray-500";
  }
}

function getActivityPath(activity: ActivityLog): string {
  switch (activity.entityType) {
    case "NOTE":
      return "/notes";
    case "PROJECT":
      return activity.entityId ? `/projects/${activity.entityId}` : "/projects";
    case "CLIENT":
      return activity.entityId ? `/clients/${activity.entityId}` : "/clients";
    case "INVOICE":
      return activity.entityId ? `/finance/invoices/${activity.entityId}` : "/finance/invoices";
    case "EXPENSE":
      return "/finance/expenses";
    case "INCOME":
      return "/finance/income";
    case "DOCUMENT":
      return "/documents";
    case "WITHDRAWAL":
      return "/finance/withdrawals";
    case "USER":
      return "/settings";
    default:
      return "/dashboard";
  }
}

// Format date for display
function formatActivityDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Activity Item Component
function ActivityItem({ activity, index }: { activity: ActivityLog; index: number }) {
  const path = getActivityPath(activity);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={path}
        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
      >
        <div className={`h-2 w-2 rounded-full mt-2 ${getActivityColor(activity.entityType)}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {activity.details || activity.entityName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatActivityDate(activity.createdAt)}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {activity.entityType}
            </Badge>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </Link>
    </motion.div>
  );
}

// Invoice Item Component
function InvoiceItem({ invoice, index }: { invoice: Invoice; index: number }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'OVERDUE': return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default: return <CircleDashed className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'text-green-500 bg-green-500/10';
      case 'OVERDUE': return 'text-red-500 bg-red-500/10';
      case 'PARTIALLY_PAID': return 'text-amber-500 bg-amber-500/10';
      default: return 'text-blue-500 bg-blue-500/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/finance/invoices/${invoice.id}`}
        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-all group"
      >
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${getStatusColor(invoice.status)}`}>
          {getStatusIcon(invoice.status)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {invoice.invoiceNumber}
            </p>
            <span className="text-xs font-semibold text-primary">
              {formatCurrency(invoice.total)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">
              {invoice.client?.companyName || 'Unknown Client'}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {invoice.issueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </motion.div>
  );
}

// Invoice Skeleton
function InvoiceSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
