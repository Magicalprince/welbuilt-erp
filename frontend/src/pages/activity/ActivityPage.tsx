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
import { useRecentActivityLogs } from "@/hooks/useFirestore";
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
  const { data: activities, isLoading } = useRecentActivityLogs(50);

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

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(activity);
    });

    return groups;
  }, [filteredActivities]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
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
      </motion.div>

      {/* Activity Timeline */}
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
                    : `No ${entityTypeConfig[filterType]?.label.toLowerCase() || filterType.toLowerCase()} activity found`
                  }
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
    </motion.div>
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
