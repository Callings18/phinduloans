// useAuth v6 - force rebuild 2026-01-29T00:30
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from '@supabase/supabase-js';
import { notificationService } from "@/utils/notificationService";

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
        console.log('[Auth] Welcome email sent successfully');
      } catch (notifyError) {
        console.error('[Auth] Failed to send welcome email:', notifyError);
      }
    }

    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRoles([]);
  }, []);

  const value = useMemo(() => ({
    user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, signOut
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
