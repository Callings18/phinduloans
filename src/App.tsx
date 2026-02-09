// App v28 - clean React hooks 2026-02-04
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import PreQualification from "./pages/PreQualification";
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
                <Route path="/pre-qualify" element={<PreQualification />} />
                <Route path="/about" element={<About />} />
                <Route path="/about-us" element={<About />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/applications" element={<AdminApplications />} />
                <Route path="/admin/borrowers" element={<AdminBorrowers />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/employers" element={<AdminEmployers />} />
                <Route path="/admin/disbursements" element={<AdminDisbursements />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/loan-products" element={<AdminLoanProducts />} />
                <Route path="/admin/loans" element={<AdminLoans />} />
                <Route path="/admin/repayments" element={<AdminRepayments />} />
                <Route path="/admin/collections" element={<AdminCollections />} />
                <Route path="/admin/staff" element={<AdminStaff />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                <Route path="/admin/write-offs" element={<AdminWriteOffs />} />
                <Route path="/admin/bulk-repayments" element={<AdminBulkRepayments />} />
                <Route path="/admin/contract-templates" element={<AdminContractTemplates />} />
                <Route path="/admin/pmic" element={<AdminPMIC />} />
                <Route path="/admin/accounts" element={<AdminAccounts />} />
                <Route path="/admin/expenses" element={<AdminExpenses />} />
                <Route path="/admin/court-cases" element={<AdminCourtCases />} />
                <Route path="/admin/wallets" element={<AdminWallets />} />
                <Route path="/admin/hr" element={<AdminHR />} />
                <Route path="/admin/payroll" element={<AdminPayroll />} />
                <Route path="/admin/email-log" element={<AdminEmailLog />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

export default App;
