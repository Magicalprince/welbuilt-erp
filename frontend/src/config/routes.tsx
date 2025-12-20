import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";

// Auth Pages
import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import SetupPage from "@/pages/setup/SetupPage";

// Dashboard Pages
import DashboardPage from "@/pages/dashboard/DashboardPage";

// Project Pages
import ProjectsPage from "@/pages/projects/ProjectsPage";
import ProjectDetailPage from "@/pages/projects/ProjectDetailPage";
import ProjectFormPage from "@/pages/projects/ProjectFormPage";

// Client Pages
import ClientsPage from "@/pages/clients/ClientsPage";
import ClientDetailPage from "@/pages/clients/ClientDetailPage";
import ClientFormPage from "@/pages/clients/ClientFormPage";

// Finance Pages
import FinancePage from "@/pages/finance/FinancePage";
import InvoicesPage from "@/pages/finance/InvoicesPage";
import InvoiceDetailPage from "@/pages/finance/InvoiceDetailPage";
import InvoiceFormPage from "@/pages/finance/InvoiceFormPage";
import ExpensesPage from "@/pages/finance/ExpensesPage";
import IncomePage from "@/pages/finance/IncomePage";
import WithdrawalsPage from "@/pages/finance/WithdrawalsPage";

// Other Pages
import DocumentsPage from "@/pages/documents/DocumentsPage";
import NotesPage from "@/pages/notes/NotesPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ActivityPage from "@/pages/activity/ActivityPage";

export const router = createBrowserRouter([
  // Auth Routes
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/setup",
    element: <SetupPage />,
  },

  // Dashboard Routes (Protected)
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      // Projects
      {
        path: "projects",
        element: <ProjectsPage />,
      },
      {
        path: "projects/new",
        element: <ProjectFormPage />,
      },
      {
        path: "projects/:id",
        element: <ProjectDetailPage />,
      },
      {
        path: "projects/:id/edit",
        element: <ProjectFormPage />,
      },
      // Clients
      {
        path: "clients",
        element: <ClientsPage />,
      },
      {
        path: "clients/new",
        element: <ClientFormPage />,
      },
      {
        path: "clients/:id",
        element: <ClientDetailPage />,
      },
      {
        path: "clients/:id/edit",
        element: <ClientFormPage />,
      },
      // Finance
      {
        path: "finance",
        element: <FinancePage />,
      },
      {
        path: "finance/invoices",
        element: <InvoicesPage />,
      },
      {
        path: "finance/invoices/new",
        element: <InvoiceFormPage />,
      },
      {
        path: "finance/invoices/:id",
        element: <InvoiceDetailPage />,
      },
      {
        path: "finance/expenses",
        element: <ExpensesPage />,
      },
      {
        path: "finance/income",
        element: <IncomePage />,
      },
      {
        path: "finance/withdrawals",
        element: <WithdrawalsPage />,
      },
      // Documents
      {
        path: "documents",
        element: <DocumentsPage />,
      },
      // Notes
      {
        path: "notes",
        element: <NotesPage />,
      },
      // Activity
      {
        path: "activity",
        element: <ActivityPage />,
      },
      // Settings
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },

  // Catch all - redirect to dashboard
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
