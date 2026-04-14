// App root component
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminRoute from "./components/admin/AdminRoute";
import PermissionRoute from "./components/admin/PermissionRoute";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/common/PWAInstallPrompt";
import { BorrowerInstallGate } from "@/components/common/BorrowerInstallGate";
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
import AdminLoanProductDashboards from "./pages/admin/AdminLoanProductDashboards";
import AdminLoanProductScopedDashboard from "./pages/admin/AdminLoanProductScopedDashboard";
import AdminCreateSalaryAdvanceLoan from "./pages/admin/AdminCreateSalaryAdvanceLoan";
import AdminCreatePaydaySoftLoan from "./pages/admin/AdminCreatePaydaySoftLoan";
import AdminCreateCollateralLoan from "./pages/admin/AdminCreateCollateralLoan";
import AdminCreateBusinessLoan from "./pages/admin/AdminCreateBusinessLoan";
import AdminCreateMotorVehicleLoan from "./pages/admin/AdminCreateMotorVehicleLoan";
import AdminCreateMarketeerLoan from "./pages/admin/AdminCreateMarketeerLoan";

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
                  <Route
                    path="/apply"
                    element={
                      <BorrowerInstallGate>
                        <Apply />
                      </BorrowerInstallGate>
                    }
                  />
                  <Route path="/calculator" element={<Calculator />} />
                  <Route
                    path="/pre-qualify"
                    element={
                      <BorrowerInstallGate>
                        <Apply />
                      </BorrowerInstallGate>
                    }
                  />
                  <Route path="/about" element={<About />} />
                  <Route path="/about-us" element={<About />} />
                  <Route
                    path="/auth"
                    element={
                      <BorrowerInstallGate variant="signup-only">
                        <Auth />
                      </BorrowerInstallGate>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <BorrowerInstallGate variant="signup-only">
                        <Auth />
                      </BorrowerInstallGate>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <BorrowerInstallGate>
                        <Dashboard />
                      </BorrowerInstallGate>
                    }
                  />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<AdminRoute />}>
                    <Route index element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
                    <Route
                      path="applications"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminApplications />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="borrowers"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "borrowers", action: "view" }}>
                            <AdminBorrowers />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "settings", action: "manage" }}>
                            <AdminSettings />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="employers"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "borrowers", action: "view" }}>
                            <AdminEmployers />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="disbursements"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "disbursement", action: "view" }}>
                            <AdminDisbursements />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="reports"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute
                            anyOf={[
                              { module: "reports", action: "view" },
                              { module: "reports", action: "export" },
                            ]}
                          >
                            <AdminReports />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="loan-products"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "products", action: "view" }}>
                            <AdminLoanProducts />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="loans/products/:productId/dashboard"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminLoanProductScopedDashboard />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="loans"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminLoans />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="loan-product-dashboards"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminLoanProductDashboards />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route path="loans/create/salary-advance" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreateSalaryAdvanceLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route path="loans/create/payday-soft" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreatePaydaySoftLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route path="loans/create/collateral" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreateCollateralLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route path="loans/create/business" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreateBusinessLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route path="loans/create/motor-vehicle" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreateMotorVehicleLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route path="loans/create/marketeer" element={<ErrorBoundary><PermissionRoute permission={{ module: "loans", action: "view" }}><AdminCreateMarketeerLoan /></PermissionRoute></ErrorBoundary>} />
                    <Route
                      path="repayments"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "repayments", action: "view" }}>
                            <AdminRepayments />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="collections"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "collections", action: "view" }}>
                            <AdminCollections />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="staff"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "settings", action: "manage" }}>
                            <AdminStaff />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="audit-logs"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "audit", action: "view" }}>
                            <AdminAuditLogs />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="write-offs"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "writeoffs", action: "view" }}>
                            <AdminWriteOffs />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="bulk-repayments"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "repayments", action: "view" }}>
                            <AdminBulkRepayments />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="contract-templates"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminContractTemplates />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="pmic"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminPMIC />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="accounts"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "disbursement", action: "view" }}>
                            <AdminAccounts />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="expenses"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "expenses", action: "view" }}>
                            <AdminExpenses />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="court-cases"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "court", action: "view" }}>
                            <AdminCourtCases />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="wallets"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "wallets", action: "view" }}>
                            <AdminWallets />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="hr"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute
                            anyOf={[
                              { module: "hr", action: "view" },
                              { module: "hr", action: "manage" },
                            ]}
                          >
                            <AdminHR />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="payroll"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute
                            anyOf={[
                              { module: "payroll", action: "view" },
                              { module: "payroll", action: "manage" },
                              { module: "payroll", action: "approve" },
                            ]}
                          >
                            <AdminPayroll />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="email-log"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminEmailLog />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route path="user-guide" element={<ErrorBoundary><AdminUserGuide /></ErrorBoundary>} />
                    <Route
                      path="roles-permissions"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminRolesPermissions />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="crb-queue"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute
                            anyOf={[
                              { module: "loans", action: "view" },
                              { module: "loans", action: "finance_approve" },
                            ]}
                          >
                            <AdminCRBQueue />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
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
