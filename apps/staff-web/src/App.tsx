// App root component
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminRoute from "./components/admin/AdminRoute";
import PermissionRoute from "./components/admin/PermissionRoute";
import ErrorBoundary from "@phinduloans/shared/components/common/ErrorBoundary";
import FloatingAssistant from "./components/assistant/FloatingAssistant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@phinduloans/shared/components/ui/toaster";
import { Toaster as Sonner } from "@phinduloans/shared/components/ui/sonner";
import { TooltipProvider } from "@phinduloans/shared/components/ui/tooltip";
import { ThemeProvider } from "@phinduloans/shared/theme/ThemeProvider";
import { AuthProvider } from "@phinduloans/shared/hooks/useAuth";

import Index from "./pages/Index";
import About from "./pages/About";
import Calculator from "./pages/Calculator";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import BorrowerDashboardGate from "./pages/BorrowerDashboardGate";
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
import AdminEmailLog from "./pages/admin/AdminEmailLog";
import AdminUserGuide from "./pages/admin/AdminUserGuide";
import AdminRolesPermissions from "./pages/admin/AdminRolesPermissions";
import AdminCRBQueue from "./pages/admin/AdminCRBQueue";
import AdminFeatureFlags from "./pages/admin/AdminFeatureFlags";
import AdminAIAgents from "./pages/admin/AdminAIAgents";
import AdminAIAgentDetail from "./pages/admin/AdminAIAgentDetail";
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
import { borrowerAppPath, getOfficeBaseUrl, isOfficeSiteMode } from "./config/publicUrls";

const queryClient = new QueryClient();
const officeMode = isOfficeSiteMode();
const officeAdminUrl = `${getOfficeBaseUrl()}/admin`;

function App() {
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
                  <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/login" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
                  <Route path="/install" element={officeMode ? <Navigate to={borrowerAppPath("/auth")} replace /> : <ErrorBoundary><Install /></ErrorBoundary>} />
                  <Route path="/download" element={officeMode ? <Navigate to={borrowerAppPath("/auth")} replace /> : <ErrorBoundary><Install /></ErrorBoundary>} />
                  <Route path="/app" element={officeMode ? <Navigate to={borrowerAppPath("/auth")} replace /> : <ErrorBoundary><Install /></ErrorBoundary>} />
                  <Route path="/pre-qualify" element={<Navigate to={borrowerAppPath("/auth")} replace />} />
                  <Route path="/dashboard" element={officeMode ? <Navigate to={borrowerAppPath("/dashboard")} replace /> : <ErrorBoundary><BorrowerDashboardGate /></ErrorBoundary>} />
                  <Route path="/profile" element={<Navigate to={borrowerAppPath("/profile")} replace />} />
                  {officeMode ? (
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
                            <AdminAIAgents />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="ai-agents/:agentKey"
                      element={
                        <ErrorBoundary>
                          <PermissionRoute adminOnly>
                            <AdminAIAgentDetail />
                          </PermissionRoute>
                        </ErrorBoundary>
                      }
                    />
                    </Route>
                  ) : (
                    <Route path="/admin/*" element={<Navigate to={officeAdminUrl} replace />} />
                  )}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <FloatingAssistant />
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
