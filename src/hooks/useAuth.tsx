// Authentication context and provider
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import { notificationService } from "@/utils/notificationService";
import { normalizePhoneToE164, isEmail } from "@/utils/authHelpers";

/** Log auth event to audit_logs (IP + device). Fire-and-forget. */
async function logAuthEvent(action: 'login' | 'signup') {
  try {
    let ip: string | null = null;
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      ip = data?.ip ?? null;
    } catch {
      // ignore IP fetch failure
    }
    const deviceInfo = typeof navigator !== 'undefined' ? { user_agent: navigator.userAgent } : null;
    await supabase.rpc('log_auth_event', {
      p_action: action,
      p_ip_address: ip,
      p_device_info: deviceInfo,
    });
  } catch {
    // non-critical
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  roles: string[];
  isAdmin: boolean;
  isStaff: boolean;
  hasRole: (role: string) => boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{
    error: Error | null;
    userId: string | null;
    emailConfirmed: boolean;
    hasSession: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; code?: string; status?: number }>;
  sendOtp: (emailOrPhone: string) => Promise<{ error: Error | null; code?: string; status?: number }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const fetchUserRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
    return data.map(r => r.role);
  }, []);

  const hasRole = useCallback((role: string) => roles.includes(role), [roles]);
  
  const isAdmin = useMemo(() => 
    roles.includes('admin') || roles.includes('super_admin'), 
    [roles]
  );

  const isStaff = useMemo(() => 
    roles.some(role =>
      ['admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'collections_officer', 'auditor', 'support'].includes(role)
    ),
    [roles]
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Handle expired/invalid sessions cleanly
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.warn('[Auth] Token refresh failed — signing out');
          supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setRoles([]);
          setIsLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRoles([]);
          setIsLoading(false);
          return;
        }

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

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (error) {
        console.warn('[Auth] Session retrieval failed:', error.message);
        // Clear stale session data without calling signOut (which can fail/loop)
        setSession(null);
        setUser(null);
        setRoles([]);
        setIsLoading(false);
        // Attempt signOut silently to clean up localStorage
        supabase.auth.signOut().catch((err) => {
          if (import.meta.env.DEV) console.warn("[Auth] signOut after session error failed:", err);
        });
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);

      if (currentSession?.user) {
        fetchUserRoles(currentSession.user.id).then(setRoles);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
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

    if (!error && data.user) {
      try {
        await notificationService.sendSignupWelcome(
          data.user.id,
          fullName,
          '',
          email
        );
        if (import.meta.env.DEV) console.log('[Auth] Welcome email sent successfully');
      } catch (notifyError) {
        console.error('[Auth] Failed to send welcome email:', notifyError);
      }
      logAuthEvent('signup');
    }

    const user = data?.user ?? null;
    const emailConfirmed = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
    return {
      error: error as Error | null,
      userId: user?.id ?? null,
      emailConfirmed,
      hasSession: Boolean(data?.session),
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      logAuthEvent('login');
      // Mark email as verified on first successful password login
      await supabase
        .from('profiles')
        .update({ email_verified_at: new Date().toISOString() })
        .eq('id', data.user.id)
        .is('email_verified_at', null);
    }
    return {
      error: error as Error | null,
      code: (error as { code?: string } | null)?.code,
      status: (error as { status?: number } | null)?.status,
    };
  }, []);

  const sendOtp = async (emailOrPhone: string): Promise<{ error: Error | null; code?: string; status?: number }> => {
    const trimmed = emailOrPhone.trim();
    if (!trimmed) return { error: new Error("Enter your email or phone number"), code: "validation_error" };

    const identifier = isEmail(trimmed) ? trimmed : normalizePhoneToE164(trimmed);
    if (!identifier) return { error: new Error("Enter a valid email or phone number"), code: "validation_error" };

    try {
      const isEmailInput = isEmail(trimmed);
      if (isEmailInput) {
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { shouldCreateUser: false },
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("not found") || msg.includes("invalid") || msg.includes("user")) return { error: new Error("No account found for this email. Please sign up first."), code: "account_not_found" };
          if (msg.includes("expired")) return { error: new Error("OTP expired. Request a new code."), code: "otp_expired" };
          if (msg.includes("rate") || msg.includes("limit")) return { error: new Error("Too many attempts. Try again later."), code: "rate_limited", status: (error as { status?: number }).status };
          return { error: error as Error, code: (error as { code?: string }).code, status: (error as { status?: number }).status };
        }
        return { error: null };
      } else {
        const normalized = normalizePhoneToE164(trimmed);
        const { error } = await supabase.auth.signInWithOtp({
          phone: normalized,
          options: { shouldCreateUser: false },
        });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("not found") || msg.includes("invalid") || msg.includes("user")) return { error: new Error("No account found for this number. Please sign up first."), code: "account_not_found" };
          if (msg.includes("expired")) return { error: new Error("OTP expired. Request a new code."), code: "otp_expired" };
          if (msg.includes("rate") || msg.includes("limit")) return { error: new Error("Too many attempts. Try again later."), code: "rate_limited", status: (error as { status?: number }).status };
          return { error: error as Error, code: (error as { code?: string }).code, status: (error as { status?: number }).status };
        }
        return { error: null };
      }
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Something went wrong"), code: "unexpected_error" };
    }
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRoles([]);
  }, []);

  const value = useMemo(() => ({
    user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, sendOtp, signOut
  }), [user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, signOut]);

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
