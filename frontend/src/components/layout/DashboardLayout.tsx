import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

const INTERN_MANAGER_ALLOWED = ["/interns"];

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
      return;
    }
    // Restrict INTERN_MANAGER to intern-related routes only
    if (!isLoading && user?.role === "INTERN_MANAGER") {
      const allowed = INTERN_MANAGER_ALLOWED.some((path) =>
        location.pathname.startsWith(path)
      );
      if (!allowed) {
        navigate("/interns", { replace: true });
      }
    }
  }, [user, isLoading, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <Header sidebarCollapsed={sidebarCollapsed} />

      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          sidebarCollapsed ? "pl-[72px]" : "pl-[240px]"
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="p-6"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
