// useAuth v7 - explicit React namespace 2026-01-29T09:00
import * as React from "react";
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

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<string[]>([]);

  const fetchUserRoles = React.useCallback(async (userId: string) => {
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

  const hasRole = React.useCallback((role: string) => roles.includes(role), [roles]);
  
  const isAdmin = React.useMemo(() => 
    roles.includes('admin') || roles.includes('super_admin'), 
    [roles]
  );

  const isStaff = React.useMemo(() => 
    roles.some(role =>
      ['admin', 'super_admin', 'loan_officer', 'credit_officer', 'finance_officer', 'collections_officer', 'auditor', 'support'].includes(role)
    ),
    [roles]
  );

  React.useEffect(() => {
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

  const signUp = React.useCallback(async (email: string, password: string, fullName: string) => {
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

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setRoles([]);
  }, []);

  const value = React.useMemo(() => ({
    user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, signOut
  }), [user, session, isLoading, roles, isAdmin, isStaff, hasRole, signUp, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
