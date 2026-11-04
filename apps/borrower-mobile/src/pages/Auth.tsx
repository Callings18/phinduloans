import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { BorrowerAuthShell } from "@/components/auth/BorrowerAuthShell";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { borrowerAppPath, officePath } from "@phinduloans/shared/config/siteMode";
import { BORROWER_GOOGLE_SIGNUP_CONSENT_KEY } from "@phinduloans/shared/config/borrowerOAuth";
import { recordBorrowerTermsConsent } from "@phinduloans/shared/utils/borrowerConsent";
import { BorrowerGoogleAuthSection } from "@/components/auth/BorrowerGoogleAuthButton";

/** Absolute borrower destination — never leave app.phindu.com for marketing Site URL. */
function goToBorrowerDestination(path: string | null) {
  const target = path && path.startsWith("/") ? path : "/dashboard";
  window.location.replace(borrowerAppPath(target));
}

const Auth = () => {
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const initialMode = searchParams.get("mode") === "signup" ? false : true;
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const [isLogin, setIsLogin] = useState(initialMode);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  const { user, isLoading, isStaff, rolesResolved, rolesError } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !rolesResolved) return;
    const pendingConsent = sessionStorage.getItem(BORROWER_GOOGLE_SIGNUP_CONSENT_KEY);
    if (pendingConsent === "1") {
      sessionStorage.removeItem(BORROWER_GOOGLE_SIGNUP_CONSENT_KEY);
      void recordBorrowerTermsConsent(user.id).then(({ error }) => {
        if (error) console.warn("Google signup consent log failed:", error.message);
      });
    }
  }, [user, rolesResolved]);

  useEffect(() => {
    if (!isLoading && user && rolesResolved) {
      if (rolesError) {
        toast({
          title: "Could not verify account type",
          description: "Please try again in a moment or contact support.",
          variant: "destructive",
        });
        return;
      }
      if (isStaff) {
        window.location.replace(officePath("/admin"));
        return;
      }
      goToBorrowerDestination(safeNextPath);
    }
  }, [user, isLoading, isStaff, rolesResolved, rolesError, safeNextPath, toast]);

  const handlePhoneAuthSuccess = () => {
    goToBorrowerDestination(safeNextPath);
  };

  const handleDemoSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDemoLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail.trim(),
      password: demoPassword,
    });
    setDemoLoading(false);
    if (error) {
      toast({
        title: "Could not sign in",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  return (
    <BorrowerAuthShell
      title={demoMode ? "Borrower Demo Sign In" : isLogin ? "Welcome Back" : "Create Your Account"}
      subtitle={demoMode ? "Use the demo credentials shared by the Phindu team." : isLogin ? "Sign in securely to your account" : ""}
      showBack={!isLogin || demoMode}
      onBack={() => navigate("/auth", { replace: true })}
      footer={
        demoMode ? (
          <p className="text-muted-foreground text-sm">
            Want to use your phone instead?{" "}
            <button type="button" onClick={() => navigate("/auth", { replace: true })} className="text-primary hover:text-primary/80 font-medium">
              Sign in with SMS
            </button>
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {isLogin ? "New to Phindu?" : "Already registered?"}{" "}
              <button
                type="button"
                onClick={() => {
                  const nextLogin = !isLogin;
                  setIsLogin(nextLogin);
                  if (nextLogin) navigate("/auth", { replace: true });
                  else navigate("/auth?mode=signup", { replace: true });
                }}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {isLogin ? "Create account" : "Sign in"}
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Client testing?{" "}
              <button type="button" onClick={() => navigate("/auth?demo=1", { replace: true })} className="text-primary hover:text-primary/80 font-medium">
                Use demo sign in
              </button>
            </p>
          </>
        )
      }
    >
      {demoMode ? (
        <form onSubmit={(event) => void handleDemoSignIn(event)} className="glass rounded-3xl p-6 sm:p-8 shadow-card border border-border/50 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="demo-email">Email</Label>
            <Input id="demo-email" type="email" autoComplete="username" required value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)} placeholder="borrower-demo@phindu.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-password">Password</Label>
            <Input id="demo-password" type="password" autoComplete="current-password" required value={demoPassword} onChange={(event) => setDemoPassword(event.target.value)} />
          </div>
          <Button type="submit" variant="hero" className="w-full h-12 rounded-xl" disabled={demoLoading}>
            {demoLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in…</> : "Sign in to demo account"}
          </Button>
        </form>
      ) : <div className="animate-slide-up">
        <PhoneAuthForm
          key={isLogin ? "phone-login" : "phone-signup"}
          purpose={isLogin ? "login" : "signup"}
          onSuccess={handlePhoneAuthSuccess}
          oauthSlot={({ termsAccepted }) => (
            <BorrowerGoogleAuthSection
              embedded
              purpose={isLogin ? "login" : "signup"}
              nextPath={safeNextPath}
              externalTermsAccepted={isLogin ? true : termsAccepted}
            />
          )}
        />
      </div>}
    </BorrowerAuthShell>
  );
};

export default Auth;
