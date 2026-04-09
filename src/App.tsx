// App root component
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminRoute from "./components/admin/AdminRoute";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/common/PWAInstallPrompt";
import { AuthProvider } from "@/hooks/useAuth";

import Index from "./pages/Index";
import About from "./pages/About";
import Calculator from "./pages/Calculator";
import Apply from "./pages/Apply";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
// PreQualification removed — /pre-qualify redirects via Apply component
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminLoans from "./pages/admin/AdminLoans";
import AdminBorrowers from "./pages/admin/AdminBorrowers";
import AdminRepayments from "./pages/admin/AdminRepayments";
import AdminDisbursements from "./pages/admin/AdminDisbursements";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLoanProducts from "./pages/admin/AdminLoanProducts";
import AdminEmployers from "./pages/admin/AdminEmployers";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminCollections from "./pages/admin/AdminCollections";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminWriteOffs from "./pages/admin/AdminWriteOffs";
import AdminBulkRepayments from "./pages/admin/AdminBulkRepayments";
import AdminContractTemplates from "./pages/admin/AdminContractTemplates";
import AdminPMIC from "./pages/admin/AdminPMIC";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminCourtCases from "./pages/admin/AdminCourtCases";
import AdminWallets from "./pages/admin/AdminWallets";
import AdminHR from "./pages/admin/AdminHR";
import AdminPayroll from "./pages/admin/AdminPayroll";
import AdminEmailLog from "./pages/admin/AdminEmailLog";
import AdminUserGuide from "./pages/admin/AdminUserGuide";
import AdminRolesPermissions from "./pages/admin/AdminRolesPermissions";
import AdminCRBQueue from "./pages/admin/AdminCRBQueue";

// Inline Theme - no external module
type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function getStoredTheme(): Theme {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("phindu-theme") as Theme | null;
    return stored || "dark";
  }
  return "dark";
}

const queryClient = new QueryClient();

function App() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const resolved = theme === "system" ? getSystemTheme() : theme;
    
    setResolvedTheme(resolved);
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    localStorage.setItem("phindu-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newTheme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(newTheme);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  const themeValue = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PWAInstallPrompt />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/apply" element={<Apply />} />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route path="/pre-qualify" element={<Apply />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/about-us" element={<About />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<AdminRoute />}>
                    <Route index element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
                    <Route path="applications" element={<ErrorBoundary><AdminApplications /></ErrorBoundary>} />
                    <Route path="borrowers" element={<ErrorBoundary><AdminBorrowers /></ErrorBoundary>} />
                    <Route path="settings" element={<ErrorBoundary><AdminSettings /></ErrorBoundary>} />
                    <Route path="employers" element={<ErrorBoundary><AdminEmployers /></ErrorBoundary>} />
                    <Route path="disbursements" element={<ErrorBoundary><AdminDisbursements /></ErrorBoundary>} />
                    <Route path="reports" element={<ErrorBoundary><AdminReports /></ErrorBoundary>} />
                    <Route path="loan-products" element={<ErrorBoundary><AdminLoanProducts /></ErrorBoundary>} />
                    <Route path="loans" element={<ErrorBoundary><AdminLoans /></ErrorBoundary>} />
                    <Route path="repayments" element={<ErrorBoundary><AdminRepayments /></ErrorBoundary>} />
                    <Route path="collections" element={<ErrorBoundary><AdminCollections /></ErrorBoundary>} />
                    <Route path="staff" element={<ErrorBoundary><AdminStaff /></ErrorBoundary>} />
                    <Route path="audit-logs" element={<ErrorBoundary><AdminAuditLogs /></ErrorBoundary>} />
                    <Route path="write-offs" element={<ErrorBoundary><AdminWriteOffs /></ErrorBoundary>} />
                    <Route path="bulk-repayments" element={<ErrorBoundary><AdminBulkRepayments /></ErrorBoundary>} />
                    <Route path="contract-templates" element={<ErrorBoundary><AdminContractTemplates /></ErrorBoundary>} />
                    <Route path="pmic" element={<ErrorBoundary><AdminPMIC /></ErrorBoundary>} />
                    <Route path="accounts" element={<ErrorBoundary><AdminAccounts /></ErrorBoundary>} />
                    <Route path="expenses" element={<ErrorBoundary><AdminExpenses /></ErrorBoundary>} />
                    <Route path="court-cases" element={<ErrorBoundary><AdminCourtCases /></ErrorBoundary>} />
                    <Route path="wallets" element={<ErrorBoundary><AdminWallets /></ErrorBoundary>} />
                    <Route path="hr" element={<ErrorBoundary><AdminHR /></ErrorBoundary>} />
                    <Route path="payroll" element={<ErrorBoundary><AdminPayroll /></ErrorBoundary>} />
                    <Route path="email-log" element={<ErrorBoundary><AdminEmailLog /></ErrorBoundary>} />
                    <Route path="user-guide" element={<ErrorBoundary><AdminUserGuide /></ErrorBoundary>} />
                    <Route path="roles-permissions" element={<ErrorBoundary><AdminRolesPermissions /></ErrorBoundary>} />
                    <Route path="crb-queue" element={<ErrorBoundary><AdminCRBQueue /></ErrorBoundary>} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
}

export default App;
