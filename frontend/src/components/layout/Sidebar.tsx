import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  FileText,
  StickyNote,
  Settings,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ClipboardList,
  BarChart3,
  Clock,
} from "lucide-react";
import { Button, LogoWithText, Logo } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const allNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/projects", label: "Projects", icon: FolderKanban },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/finance", label: "Finance", icon: Wallet },
  { path: "/quotations", label: "Quotations", icon: ClipboardList },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/interns", label: "Interns", icon: GraduationCap },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/notes", label: "Notes", icon: StickyNote },
  { path: "/activity", label: "Audit Log", icon: Clock },
  { path: "/settings", label: "Settings", icon: Settings },
];

const internManagerNavItems = [
  { path: "/interns", label: "Interns", icon: GraduationCap },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const navItems = user?.role === "INTERN_MANAGER" ? internManagerNavItems : allNavItems;

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 z-40 h-screen border-r bg-gradient-to-b from-card via-card to-muted/30 flex flex-col shadow-xl"
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-border/50 px-4">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LogoWithText collapsed={false} />
            </motion.div>
          ) : (
            <motion.div
              key="symbol-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Logo variant="symbol" size="md" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary rounded-xl"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("h-5 w-5 shrink-0 relative z-10", isCollapsed && "mx-auto")} />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative z-10"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Toggle Button */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn("w-full", !isCollapsed && "justify-start px-3")}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
