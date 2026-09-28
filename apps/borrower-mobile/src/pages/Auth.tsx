import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { Button } from "@phinduloans/shared/components/ui/button";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { borrowerAppPath, officePath } from "@phinduloans/shared/config/siteMode";
import { Sparkles, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { downloadApk, isAndroidDevice } from "@phinduloans/shared/utils/appDownload";

/** Absolute borrower destination — never leave app.phindu.com for marketing Site URL. */
function goToBorrowerDestination(path: string | null) {
  const target = path && path.startsWith("/") ? path : "/dashboard";
  window.location.replace(borrowerAppPath(target));
}

/** Borrower-only sign-in (phone OTP). */
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
    toast({
      title: isLogin ? "Welcome back!" : "Account Created!",
      description: isLogin
        ? "You've successfully logged in."
        : "Welcome to Phindu Credit Solutions.",
    });
    goToBorrowerDestination(safeNextPath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
                <Sparkles className="text-primary-foreground" size={24} />
              </div>
              <div className="text-left">
                <span className="text-foreground font-bold text-xl block">PHINDU</span>
                <span className="text-muted-foreground text-xs tracking-wider">CREDIT SOLUTIONS</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin ? "Sign in with your phone number" : "Get started with your phone number"}
            </p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-card animate-slide-up">
            <PhoneAuthForm
              purpose={isLogin ? "login" : "signup"}
              onSuccess={handlePhoneAuthSuccess}
            />

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    const nextLogin = !isLogin;
                    setIsLogin(nextLogin);
                    if (nextLogin) navigate("/auth", { replace: true });
                    else navigate("/auth?mode=signup", { replace: true });
                  }}
                  className="ml-2 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center space-y-3 animate-fade-in">
            <p className="text-xs text-muted-foreground">
              Apply online in your browser — no install required. Your data is saved to your account when you sign in.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" asChild>
                <Link to="/install">
                  <Smartphone size={14} className="mr-1.5" />
                  Download Our App
                </Link>
              </Button>
              {isAndroidDevice() && (
                <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={downloadApk}>
                  Download now
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
