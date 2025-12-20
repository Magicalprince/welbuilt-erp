import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  User,
  Settings,
  ChevronDown,
  FileText,
  Users,
  FolderOpen,
  Receipt,
  Wallet,
  Upload,
  StickyNote,
} from "lucide-react";
import { Button, Avatar, Input, Skeleton } from "@/components/ui";
import { cn, getRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useRecentActivityLogs } from "@/hooks/useFirestore";
import type { ActivityLog } from "@/types";

interface HeaderProps {
  sidebarCollapsed: boolean;
}

const getNotificationIcon = (entityType: ActivityLog["entityType"]) => {
  const iconConfig: Record<ActivityLog["entityType"], { icon: typeof Bell; color: string; bg: string }> = {
    PROJECT: { icon: FolderOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
    CLIENT: { icon: Users, color: "text-green-500", bg: "bg-green-500/10" },
    INVOICE: { icon: Receipt, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    EXPENSE: { icon: Wallet, color: "text-red-500", bg: "bg-red-500/10" },
    INCOME: { icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    DOCUMENT: { icon: Upload, color: "text-purple-500", bg: "bg-purple-500/10" },
    NOTE: { icon: StickyNote, color: "text-orange-500", bg: "bg-orange-500/10" },
    WITHDRAWAL: { icon: Wallet, color: "text-pink-500", bg: "bg-pink-500/10" },
    USER: { icon: User, color: "text-primary", bg: "bg-primary/10" },
  };
  return iconConfig[entityType] || { icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
};

export function Header({ sidebarCollapsed }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { data: recentActivity, isLoading: loadingActivity } = useRecentActivityLogs(5);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 border-b border-border/50 bg-background/80 backdrop-blur-md transition-all duration-300",
        sidebarCollapsed ? "left-[72px]" : "left-[256px]"
      )}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects, clients..."
            className="pl-10 bg-muted/30 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary/50"
          />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {recentActivity && recentActivity.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Button>

            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-xl p-4"
              >
                <h3 className="font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loadingActivity ? (
                    <>
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-3 p-2">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : recentActivity && recentActivity.length > 0 ? (
                    recentActivity.map((activity) => {
                      const { icon: Icon, color, bg } = getNotificationIcon(activity.entityType);
                      return (
                        <div
                          key={activity.id}
                          className="flex gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                        >
                          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", bg)}>
                            <Icon className={cn("h-5 w-5", color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{activity.details || activity.entityName}</p>
                            <p className="text-xs text-muted-foreground">{getRelativeTime(activity.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No recent activity
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="w-full mt-3 text-sm"
                  onClick={() => {
                    navigate("/");
                    setShowNotifications(false);
                  }}
                >
                  View dashboard
                </Button>
              </motion.div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors"
            >
              <Avatar name={user?.name || "User"} email={user?.email} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{user?.name || "Founder"}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.equityPercent}% Equity
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-xl py-2"
              >
                <div className="px-4 py-3 border-b flex items-center gap-3">
                  <Avatar name={user?.name || "User"} email={user?.email} size="lg" />
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setShowDropdown(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setShowDropdown(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
                <div className="border-t py-1">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
