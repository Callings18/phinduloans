import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { BorrowerAuthShell } from "@/components/auth/BorrowerAuthShell";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
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
  const initialMode = searchParams.get("mode") === "signup" ? false : true;
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const [isLogin, setIsLogin] = useState(initialMode);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  return (
    <BorrowerAuthShell
      title={isLogin ? "Welcome Back" : "Create Your Account"}
      subtitle={isLogin ? "Sign in securely to your account" : ""}
      showBack={!isLogin}
      onBack={() => navigate("/auth", { replace: true })}
      footer={
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
      }
    >
      <div className="animate-slide-up">
        <PhoneAuthForm
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
      </div>
    </BorrowerAuthShell>
  );
};

export default Auth;
