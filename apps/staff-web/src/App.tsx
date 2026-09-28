// App root component
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import AdminRoute from "./components/admin/AdminRoute";
import PermissionRoute from "./components/admin/PermissionRoute";
import ErrorBoundary from "@phinduloans/shared/components/common/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@phinduloans/shared/components/ui/toaster";
import { Toaster as Sonner } from "@phinduloans/shared/components/ui/sonner";
import { TooltipProvider } from "@phinduloans/shared/components/ui/tooltip";
import { ThemeProvider } from "@phinduloans/shared/theme/ThemeProvider";
import { AuthProvider } from "@phinduloans/shared/hooks/useAuth";

import Index from "./pages/Index";
import About from "./pages/About";
import Calculator from "./pages/Calculator";
import Faq from "./pages/Faq";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import LoanProducts from "./pages/LoanProducts";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminLoanDrafts from "./pages/admin/AdminLoanDrafts";
import AdminLoans from "./pages/admin/AdminLoans";
import AdminBorrowers from "./pages/admin/AdminBorrowers";
import AdminRepayments from "./pages/admin/AdminRepayments";
import AdminDisbursements from "./pages/admin/AdminDisbursements";
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
import AdminExpenses from "./pages/admin/AdminExpenses";
import AdminCourtCases from "./pages/admin/AdminCourtCases";
import AdminEmailLog from "./pages/admin/AdminEmailLog";
import AdminUserGuide from "./pages/admin/AdminUserGuide";
import AdminRolesPermissions from "./pages/admin/AdminRolesPermissions";
import AdminCRBQueue from "./pages/admin/AdminCRBQueue";
import AdminFeatureFlags from "./pages/admin/AdminFeatureFlags";
import { borrowerAppPath, getOfficeBaseUrl, getSiteModeFromHostname, isOfficeSiteMode } from "./config/publicUrls";
import ExternalRedirect from "./components/common/ExternalRedirect";

const queryClient = new QueryClient();
/** Hostname-aware so one Cloudflare worker can serve marketing + office correctly. */
function useStaffWebMode() {
  const hostMode = getSiteModeFromHostname();
  const officeMode = isOfficeSiteMode() || hostMode === "office";
  /** Local/preview hosts are "dev" — keep /admin in-app so preview isn't broken by a production office redirect. */
  const serveAdminLocally = officeMode || hostMode === "dev";
  return { officeMode, serveAdminLocally };
}
const officeAdminUrl = `${getOfficeBaseUrl()}/admin`;

/** Marketing /auth|/login → absolute borrower app URL, preserving query string. */
function MarketingBorrowerAuthRedirect() {
  const { search } = useLocation();
  return <ExternalRedirect to={borrowerAppPath(`/auth${search}`)} />;
}

const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminAccounts = lazy(() => import("./pages/admin/AdminAccounts"));
const AdminHR = lazy(() => import("./pages/admin/AdminHR"));
const AdminPayroll = lazy(() => import("./pages/admin/AdminPayroll"));
const AdminPayrollTaxConfig = lazy(() => import("./pages/admin/AdminPayrollTaxConfig"));
const AdminAIAgents = lazy(() => import("./pages/admin/AdminAIAgents"));
const AdminAIAgentDetail = lazy(() => import("./pages/admin/AdminAIAgentDetail"));
const AdminAIOpsCenter = lazy(() => import("./pages/admin/AdminAIOpsCenter"));
const AdminHousesIndex = lazy(() => import("./pages/admin/houses/AdminHousesIndex"));
const HouseLayout = lazy(() => import("./components/admin/house/HouseLayout"));
const HouseDashboardPage = lazy(() => import("./pages/admin/houses/HouseDashboardPage"));
const HouseBorrowersPage = lazy(() => import("./pages/admin/houses/HouseBorrowersPage"));
const HouseBorrowerDetailPage = lazy(() => import("./pages/admin/houses/HouseBorrowerDetailPage"));
const HouseLoansPage = lazy(() => import("./pages/admin/houses/HouseLoansPage"));
const HouseLoanCreatePage = lazy(() => import("./pages/admin/houses/HouseLoanCreatePage"));
const HouseLoanEditPage = lazy(() => import("./pages/admin/houses/HouseLoanEditPage"));
const HouseLoanDetailPage = lazy(() => import("./pages/admin/houses/HouseLoanDetailPage"));
const HouseReviewPage = lazy(() => import("./pages/admin/houses/HouseReviewPage"));
const HouseDisbursementsPage = lazy(() => import("./pages/admin/houses/HouseDisbursementsPage"));
const HouseCollectionsPage = lazy(() => import("./pages/admin/houses/HouseCollectionsPage"));
const HouseReportsPage = lazy(() => import("./pages/admin/houses/HouseReportsPage"));
const HouseReconciliationPage = lazy(() => import("./pages/admin/houses/HouseReconciliationPage"));

function AdminRouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function App() {
  const { officeMode, serveAdminLocally } = useStaffWebMode();

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Index /></ErrorBoundary>} />
                  <Route path="/calculator" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Calculator /></ErrorBoundary>} />
                  <Route path="/about" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><About /></ErrorBoundary>} />
                  <Route path="/about-us" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><About /></ErrorBoundary>} />
                  <Route path="/faq" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Faq /></ErrorBoundary>} />
                  <Route path="/privacy" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Privacy /></ErrorBoundary>} />
                  <Route path="/terms" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Terms /></ErrorBoundary>} />
                  <Route path="/loan-products" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><LoanProducts /></ErrorBoundary>} />
                  <Route path="/contact" element={officeMode ? <Navigate to="/admin" replace /> : <ErrorBoundary><Contact /></ErrorBoundary>} />
                  {/* Staff email/password Auth only on office; marketing Login → borrower SMS OTP */}
                  <Route
                    path="/auth"
                    element={
                      officeMode ? (
                        <ErrorBoundary><Auth /></ErrorBoundary>
                      ) : (
                        <MarketingBorrowerAuthRedirect />
                      )
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      officeMode ? (
                        <ErrorBoundary><Auth /></ErrorBoundary>
                      ) : (
                        <MarketingBorrowerAuthRedirect />
                      )
                    }
                  />
                  {/* Install UX lives only on the borrower app (app.phindu.com) */}
                  <Route path="/install" element={<ExternalRedirect to={borrowerAppPath("/install")} />} />
                  <Route path="/download" element={<ExternalRedirect to={borrowerAppPath("/install")} />} />
                  <Route path="/app" element={<ExternalRedirect to={borrowerAppPath("/auth")} />} />
                  <Route path="/pre-qualify" element={<ExternalRedirect to={borrowerAppPath("/auth")} />} />
                  <Route path="/apply" element={<ExternalRedirect to={borrowerAppPath("/apply")} />} />
                  {/* Borrower UI lives only on app.phindu.com — never host dashboard on marketing/office */}
                  <Route path="/dashboard" element={<ExternalRedirect to={borrowerAppPath("/dashboard")} />} />
                  <Route path="/profile" element={<ExternalRedirect to={borrowerAppPath("/profile")} />} />
                  {serveAdminLocally ? (
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
                            <AdminRouteSuspense>
                              <AdminReports />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <AdminHousesIndex />
                            </AdminRouteSuspense>
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="houses/:productCode"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute permission={{ module: "house", action: "dashboard_view" }}>
                            <AdminRouteSuspense>
                              <HouseLayout />
                            </AdminRouteSuspense>
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    >
                      <Route
                        index
                        element={<PermissionRoute permission={{ module: "house", action: "dashboard_view" }}><AdminRouteSuspense><HouseDashboardPage /></AdminRouteSuspense></PermissionRoute>}
                      />
                      <Route
                        path="borrowers"
                        element={<PermissionRoute permission={{ module: "house", action: "borrowers_view" }}><AdminRouteSuspense><HouseBorrowersPage /></AdminRouteSuspense></PermissionRoute>}
                      />
                      <Route
                        path="borrowers/:borrowerId"
                        element={<PermissionRoute permission={{ module: "house", action: "borrowers_view" }}><AdminRouteSuspense><HouseBorrowerDetailPage /></AdminRouteSuspense></PermissionRoute>}
                      />
                      <Route
                        path="loans"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_view" }}><AdminRouteSuspense><HouseLoansPage /></AdminRouteSuspense></PermissionRoute>}
                      />
                      <Route
                        path="loans/create"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_create" }}><AdminRouteSuspense><HouseLoanCreatePage /></AdminRouteSuspense></PermissionRoute>}
                      />
                      <Route
                        path="loans/:loanId/edit"
                        element={<PermissionRoute permission={{ module: "house", action: "loans_update" }}><AdminRouteSuspense><HouseLoanEditPage /></AdminRouteSuspense></PermissionRoute>}
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
                            <AdminRouteSuspense>
                              <HouseLoanDetailPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <HouseReviewPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <HouseDisbursementsPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <HouseCollectionsPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <HouseReportsPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <HouseReconciliationPage />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <AdminAccounts />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <AdminHR />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <AdminPayroll />
                            </AdminRouteSuspense>
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
                            <AdminRouteSuspense>
                              <AdminPayrollTaxConfig />
                            </AdminRouteSuspense>
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
                    <Route
                      path="ai-agents"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminRouteSuspense>
                              <AdminAIAgents />
                            </AdminRouteSuspense>
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="ai-agents/:agentKey"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminRouteSuspense>
                              <AdminAIAgentDetail />
                            </AdminRouteSuspense>
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="ai-ops"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminRouteSuspense>
                              <AdminAIOpsCenter />
                            </AdminRouteSuspense>
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    </Route>
                  ) : (
                    <Route
                      path="/admin/*"
                      element={<ExternalRedirect to={officeAdminUrl} preservePath />}
                    />
                  )}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
