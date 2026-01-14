import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import PWAInstallPrompt from "@/components/common/PWAInstallPrompt";
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
import { useEffect } from "react";

const queryClient = new QueryClient();

function App() {
  // Apply dark theme on mount
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
