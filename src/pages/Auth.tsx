import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? false : true;
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const [isLogin, setIsLogin] = useState(initialMode);

  const { user, isLoading, isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(safeNextPath || (isStaff ? "/admin" : "/dashboard"));
    }
  }, [user, isLoading, isStaff, navigate, safeNextPath]);

  const handlePhoneAuthSuccess = () => {
    toast({
      title: isLogin ? "Welcome back!" : "Account Created!",
      description: isLogin
        ? "You've successfully logged in."
        : "Welcome to Phindu Credit Solutions.",
    });
    navigate(safeNextPath || "/dashboard");
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
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
              {isLogin
                ? "Sign in with your phone number"
                : "Get started with your phone number"}
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

          <div className="text-center mt-6">
            <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
              <a href="/">← Back to Home</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
