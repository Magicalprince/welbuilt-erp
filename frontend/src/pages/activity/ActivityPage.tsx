import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock,
  ArrowLeft,
  Filter,
  Calendar,
  FileText,
  Users,
  FolderKanban,
  Wallet,
  TrendingDown,
  StickyNote,
  File,
  User,
  Banknote,
  ArrowRight,
  GraduationCap,
  Shield,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
  Select,
} from "@/components/ui";
import { useRecentActivityLogs, useInternActivityLogs } from "@/hooks/useFirestore";
import { useAuthStore } from "@/store/authStore";
import type { ActivityLog } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const entityTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  INVOICE: { label: "Invoice", icon: FileText, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  CLIENT: { label: "Client", icon: Users, color: "text-green-500", bgColor: "bg-green-500/10" },
  PROJECT: { label: "Project", icon: FolderKanban, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  WITHDRAWAL: { label: "Withdrawal", icon: Wallet, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  EXPENSE: { label: "Expense", icon: TrendingDown, color: "text-red-500", bgColor: "bg-red-500/10" },
  DOCUMENT: { label: "Document", icon: File, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  INCOME: { label: "Income", icon: Banknote, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  NOTE: { label: "Note", icon: StickyNote, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  USER: { label: "User", icon: User, color: "text-primary", bgColor: "bg-primary/10" },
  INTERN: { label: "Intern", icon: GraduationCap, color: "text-violet-500", bgColor: "bg-violet-500/10" },
};

const internActionLabels: Record<string, string> = {
  CREATE: "Added intern",
  DELETE: "Deleted intern",
  UPDATE: "Updated intern",
  GENERATE_CERTIFICATE: "Generated certificate",
  GENERATE_OFFER_LETTER: "Generated offer letter",
  GENERATE_PAYSLIP: "Generated payslip",
  GENERATE_ATTENDANCE: "Generated attendance report",
};

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

function formatActivityDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ActivityPage() {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"general" | "intern_audit">("general");
  const { data: activities, isLoading } = useRecentActivityLogs(50);
  const { data: internActivities, isLoading: internLoading } = useInternActivityLogs();
  const user = useAuthStore((s) => s.user);
  const isFounder = user?.role === "FOUNDER";

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (filterType === "ALL") return activities;
    return activities.filter((a) => a.entityType === filterType);
  }, [activities, filterType]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    filteredActivities.forEach((activity) => {
      const date = activity.createdAt;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = "Yesterday";
      } else {
        key = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });
    return groups;
  }, [filteredActivities]);

  const exportInternAuditCSV = () => {
    if (!internActivities?.length) return;
    const rows = [
      ["Timestamp", "Action", "Intern Name", "Intern ID", "Performed By (User ID)", "Details"],
      ...internActivities.map((a) => [
        a.createdAt.toISOString(),
        internActionLabels[a.action] || a.action,
        a.entityName,
        a.entityId,
        a.userId,
        a.details || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intern-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Activity</h1>
            <p className="text-muted-foreground mt-1">
              Track all changes and updates across your workspace
            </p>
          </div>
        </div>
        {activeTab === "general" && (
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-40"
              options={[
                { value: "ALL", label: "All Activity" },
                ...Object.entries(entityTypeConfig).map(([key, config]) => ({
                  value: key,
                  label: `${config.label}s`,
                })),
              ]}
            />
          </div>
        )}
        {activeTab === "intern_audit" && (
          <Button variant="outline" size="sm" onClick={exportInternAuditCSV} disabled={!internActivities?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </motion.div>

      {/* Tab bar — only show Intern Audit tab to founders */}
      {isFounder && (
        <motion.div variants={itemVariants} className="flex gap-2 border-b border-border/50 pb-0">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            General Activity
          </button>
          <button
            onClick={() => setActiveTab("intern_audit")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "intern_audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            Intern Audit Log
            {internActivities && internActivities.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {internActivities.length}
              </Badge>
            )}
          </button>
        </motion.div>
      )}

      {/* General Activity Timeline */}
      {activeTab === "general" && (
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Recent Activity
                {filteredActivities.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredActivities.length} {filteredActivities.length === 1 ? "item" : "items"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : Object.keys(groupedActivities).length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No activity found</h3>
                  <p className="text-muted-foreground mt-1">
                    {filterType === "ALL"
                      ? "Activities will appear here as you work"
                      : `No ${entityTypeConfig[filterType]?.label.toLowerCase() || filterType.toLowerCase()} activity found`}
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
                    <div key={dateGroup}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {dateGroup}
                      </h3>
                      <div className="space-y-2">
                        {groupActivities.map((activity, index) => (
                          <ActivityCard key={activity.id} activity={activity} index={index} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Intern Audit Log (founders only) */}
      {activeTab === "intern_audit" && isFounder && (
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-violet-500" />
                Intern Manager Audit Log
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Immutable record of all intern management actions — certificate generation, deletions, and more.
                Logs persist even if the intern record is deleted.
              </p>
            </CardHeader>
            <CardContent>
              {internLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !internActivities?.length ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No intern activity logged yet</h3>
                  <p className="text-muted-foreground mt-1">
                    Intern manager actions will appear here automatically
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Timestamp</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Intern</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Performed By</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internActivities.map((log) => (
                        <tr key={log.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {log.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            {" "}
                            {log.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-3">
                            <InternActionBadge action={log.action} />
                          </td>
                          <td className="p-3">
                            <p className="font-medium">{log.entityName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{log.entityId.slice(0, 8)}…</p>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {(log.metadata?.userName as string) || (
                              <span className="font-mono">{log.userId.slice(0, 8)}…</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[240px] truncate" title={log.details}>
                            {log.details || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function InternActionBadge({ action }: { action: string }) {
  const colorMap: Record<string, string> = {
    CREATE: "bg-emerald-500/10 text-emerald-600",
    DELETE: "bg-red-500/10 text-red-600",
    UPDATE: "bg-blue-500/10 text-blue-600",
    GENERATE_CERTIFICATE: "bg-violet-500/10 text-violet-600",
    GENERATE_OFFER_LETTER: "bg-indigo-500/10 text-indigo-600",
    GENERATE_PAYSLIP: "bg-amber-500/10 text-amber-600",
    GENERATE_ATTENDANCE: "bg-cyan-500/10 text-cyan-600",
  };
  const label = internActionLabels[action] || action;
  const cls = colorMap[action] || "bg-gray-500/10 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ActivityCard({ activity, index }: { activity: ActivityLog; index: number }) {
  const config = entityTypeConfig[activity.entityType] || {
    label: activity.entityType,
    icon: File,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  };
  const Icon = config.icon;
  const path = getActivityPath(activity);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        to={path}
        className="flex items-start gap-4 p-4 rounded-xl hover:bg-accent/50 transition-all group border border-transparent hover:border-border/50"
      >
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.bgColor}`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium group-hover:text-primary transition-colors">
                {activity.details || activity.entityName}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {activity.entityName && activity.details && activity.entityName}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">
                {config.label}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2" title={formatFullDate(activity.createdAt)}>
            {formatActivityDate(activity.createdAt)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
