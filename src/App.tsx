import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Apply from "./pages/Apply";
import Calculator from "./pages/Calculator";
import About from "./pages/About";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBorrowers from "./pages/admin/AdminBorrowers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminEmployers from "./pages/admin/AdminEmployers";
import AdminDisbursements from "./pages/admin/AdminDisbursements";
import AdminReports from "./pages/admin/AdminReports";
import AdminLoanProducts from "./pages/admin/AdminLoanProducts";
import AdminLoans from "./pages/admin/AdminLoans";
import AdminRepayments from "./pages/admin/AdminRepayments";
import AdminCollections from "./pages/admin/AdminCollections";
import AdminStaff from "./pages/admin/AdminStaff";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/about" element={<About />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
