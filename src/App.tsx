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
import Install from "./pages/Install";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminLoanDrafts from "./pages/admin/AdminLoanDrafts";
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
import AdminHR from "./pages/admin/AdminHR";
import AdminPayroll from "./pages/admin/AdminPayroll";
import AdminPayrollTaxConfig from "./pages/admin/AdminPayrollTaxConfig";

import AdminUserGuide from "./pages/admin/AdminUserGuide";
import AdminRolesPermissions from "./pages/admin/AdminRolesPermissions";
import AdminCRBQueue from "./pages/admin/AdminCRBQueue";
import AdminFeatureFlags from "./pages/admin/AdminFeatureFlags";
import AdminHousesIndex from "./pages/admin/houses/AdminHousesIndex";
import HouseLayout from "./components/admin/house/HouseLayout";
import HouseDashboardPage from "./pages/admin/houses/HouseDashboardPage";
import HouseBorrowersPage from "./pages/admin/houses/HouseBorrowersPage";
import HouseBorrowerDetailPage from "./pages/admin/houses/HouseBorrowerDetailPage";
import HouseLoansPage from "./pages/admin/houses/HouseLoansPage";
import HouseLoanCreatePage from "./pages/admin/houses/HouseLoanCreatePage";
import HouseLoanEditPage from "./pages/admin/houses/HouseLoanEditPage";
import HouseLoanDetailPage from "./pages/admin/houses/HouseLoanDetailPage";
import HouseReviewPage from "./pages/admin/houses/HouseReviewPage";
import HouseDisbursementsPage from "./pages/admin/houses/HouseDisbursementsPage";
import HouseCollectionsPage from "./pages/admin/houses/HouseCollectionsPage";
import HouseReportsPage from "./pages/admin/houses/HouseReportsPage";
import HouseReconciliationPage from "./pages/admin/houses/HouseReconciliationPage";

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
              <BrowserRouter>
                <PWAInstallPrompt />
                <Routes>
                  <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                  <Route path="/apply" element={<ErrorBoundary><Apply /></ErrorBoundary>} />
                  <Route path="/calculator" element={<ErrorBoundary><Calculator /></ErrorBoundary>} />
                  <Route path="/pre-qualify" element={<ErrorBoundary><Apply /></ErrorBoundary>} />
                  <Route path="/about" element={<ErrorBoundary><About /></ErrorBoundary>} />
                  <Route path="/about-us" element={<ErrorBoundary><About /></ErrorBoundary>} />
                  <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/login" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
                  <Route path="/install" element={<ErrorBoundary><Install /></ErrorBoundary>} />
                  <Route path="/download" element={<ErrorBoundary><Install /></ErrorBoundary>} />
                  <Route path="/app" element={<ErrorBoundary><Install /></ErrorBoundary>} />
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
                      path="loan-drafts"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminLoanDrafts />
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
                          <PermissionRoute adminOnly>
                            <AdminLoanProducts />
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
                      path="houses"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "loans", action: "view" }}>
                            <AdminHousesIndex />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="houses/:productCode"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "house", action: "dashboard_view" }}>
                            <HouseLayout />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    >
                      <Route
                        index
                        element={<PermissionRoute permission={{ module: "house", action: "dashboard_view" }}><HouseDashboardPage /></PermissionRoute>}
                      />
                      <Route
                        path="borrowers"
                        element={<PermissionRoute permission={{ module: "house", action: "borrowers_view" }}><HouseBorrowersPage /></PermissionRoute>}
                      />
                      <Route
                        path="borrowers/:borrowerId"
                        element={<PermissionRoute permission={{ module: "house", action: "borrowers_view" }}><HouseBorrowerDetailPage /></PermissionRoute>}
                      />
                      <Route
                        path="loans"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_view" }}><HouseLoansPage /></PermissionRoute>}
                      />
                      <Route
                        path="loans/create"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_create" }}><HouseLoanCreatePage /></PermissionRoute>}
                      />
                      <Route
                        path="loans/:loanId/edit"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_update" }}><HouseLoanEditPage /></PermissionRoute>}
                      />
                      <Route
                        path="loans/:loanId"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "loans_view" },
                              { module: "house", action: "loans_update" },
                            ]}
                          >
                            <HouseLoanDetailPage />
                          </PermissionRoute>
                        }
                      />
                      <Route
                        path="review"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "review_officer_approve" },
                              { module: "house", action: "review_finance_approve" },
                              { module: "house", action: "review_manager_approve" },
                            ]}
                          >
                            <HouseReviewPage />
                          </PermissionRoute>
                        }
                      />
                      <Route
                        path="disbursements"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "disbursement_view" },
                              { module: "house", action: "disbursement_disburse" },
                            ]}
                          >
                            <HouseDisbursementsPage />
                          </PermissionRoute>
                        }
                      />
                      <Route
                        path="collections"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "collections_view" },
                              { module: "house", action: "collections_manage" },
                            ]}
                          >
                            <HouseCollectionsPage />
                          </PermissionRoute>
                        }
                      />
                      <Route
                        path="reports"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "reports_view" },
                              { module: "house", action: "reports_export" },
                            ]}
                          >
                            <HouseReportsPage />
                          </PermissionRoute>
                        }
                      />
                      <Route
                        path="reconciliation"
                        element={
                          <PermissionRoute
                            anyOf={[
                              { module: "house", action: "collections_view" },
                              { module: "house", action: "collections_manage" },
                            ]}
                          >
                            <HouseReconciliationPage />
                          </PermissionRoute>
                        }
                      />
                    </Route>
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
                      path="payroll-tax-config"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute
                            anyOf={[
                              { module: "payroll", action: "view" },
                              { module: "payroll", action: "manage" },
                              { module: "payroll", action: "approve" },
                            ]}
                          >
                            <AdminPayrollTaxConfig />
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
                    <Route
                      path="feature-flags"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminFeatureFlags />
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
