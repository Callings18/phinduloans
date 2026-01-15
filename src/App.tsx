import React, { useState, useEffect, createContext, useContext, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import { ThemeProvider } from "@/hooks/useTheme";
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

// ============ Auth Context ============
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  roles: string[];
  isAdmin: boolean;
  isStaff: boolean;
  hasRole: (role: string) => boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
    return data.map(r => r.role);
  };

  const hasRole = (role: string) => roles.includes(role);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  const isStaff = roles.some(role =>
    ['admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'collections_officer', 'auditor', 'support'].includes(role)
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        if (currentSession?.user) {
          fetchUserRoles(currentSession.user.id).then(setRoles);
        } else {
          setRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);

      if (currentSession?.user) {
        fetchUserRoles(currentSession.user.id).then(setRoles);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const value = useMemo(() => ({
    user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, signOut
  }), [user, session, isLoading, roles, isAdmin, isStaff]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============ Query Client & App ============
const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;
