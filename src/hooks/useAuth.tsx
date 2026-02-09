import React, { useState, useEffect, useMemo, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import { notificationService } from "@/utils/notificationService";
import { normalizePhoneToE164, isEmail } from "@/utils/authHelpers";

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
  sendOtp: (emailOrPhone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    // Send welcome email if signup was successful
    if (!error && data.user) {
      try {
        await notificationService.sendSignupWelcome(
          data.user.id,
          fullName,
          '', // Phone not available at signup
          email
        );
        console.log('[Auth] Welcome email sent successfully');
      } catch (notifyError) {
        console.error('[Auth] Failed to send welcome email:', notifyError);
        // Don't fail signup if notification fails
      }
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const sendOtp = async (emailOrPhone: string): Promise<{ error: Error | null }> => {
    const trimmed = emailOrPhone.trim();
    if (!trimmed) return { error: new Error("Enter your email or phone number") };

    const identifier = isEmail(trimmed) ? trimmed : normalizePhoneToE164(trimmed);
    if (!identifier) return { error: new Error("Enter a valid email or phone number") };

    try {
      const isEmailInput = isEmail(trimmed);
      if (isEmailInput) {
        const { data: profileRows } = await supabase.from("profiles").select("id").eq("email", trimmed).limit(1);
        const exists = profileRows && profileRows.length > 0;
        if (!exists) {
          const { data: appRows } = await supabase.from("loan_applications").select("id").eq("email", trimmed).limit(1);
          if (!appRows?.length) return { error: new Error("No account found for this email. Please sign up first.") };
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { shouldCreateUser: false },
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("not found") || msg.includes("invalid") || msg.includes("user")) return { error: new Error("No account found for this email. Please sign up first.") };
          if (msg.includes("expired")) return { error: new Error("OTP expired. Request a new code.") };
          if (msg.includes("rate") || msg.includes("limit")) return { error: new Error("Too many attempts. Try again later.") };
          return { error: error as Error };
        }
        return { error: null };
      } else {
        const normalized = normalizePhoneToE164(trimmed);
        const { data: p1 } = await supabase.from("profiles").select("id").eq("phone", normalized).limit(1);
        const { data: p2 } = trimmed !== normalized ? await supabase.from("profiles").select("id").eq("phone", trimmed).limit(1) : { data: [] };
        const exists = (p1 && p1.length > 0) || (p2 && p2.length > 0);
        if (!exists) {
          const { data: a1 } = await supabase.from("loan_applications").select("id").eq("phone", normalized).limit(1);
          const { data: a2 } = trimmed !== normalized ? await supabase.from("loan_applications").select("id").eq("phone", trimmed).limit(1) : { data: [] };
          const appRows = (a1?.length ? a1 : a2) ?? [];
          if (!appRows.length) return { error: new Error("No account found for this number. Please sign up first.") };
        }
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalized,
          options: { shouldCreateUser: false },
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("not found") || msg.includes("invalid") || msg.includes("user")) return { error: new Error("No account found for this number. Please sign up first.") };
          if (msg.includes("expired")) return { error: new Error("OTP expired. Request a new code.") };
          if (msg.includes("rate") || msg.includes("limit")) return { error: new Error("Too many attempts. Try again later.") };
          return { error: error as Error };
        }
        return { error: null };
      }
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Something went wrong") };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const value = useMemo(() => ({
    user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, sendOtp, signOut
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
