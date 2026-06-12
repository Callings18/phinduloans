import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? false : true;
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;

  const [isLogin, setIsLogin] = useState(initialMode);
  const [audience, setAudience] = useState<"borrower" | "staff">(
    searchParams.get("staff") === "1" ? "staff" : "borrower"
  );

  // staff email/password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { user, isLoading, isStaff, signIn } = useAuth();
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

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Enter your email and password.", variant: "destructive" });
      return;
    }
    setStaffLoading(true);
    const { error } = await signIn(email.trim(), password);
    setStaffLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome back!", description: "Redirecting to admin dashboard." });
    navigate(safeNextPath || "/admin");
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${safeNextPath || "/dashboard"}`,
      });

      if (result.error) {
        toast({
          title: "Google sign-in failed",
          description: result.error.message || "Please try again.",
          variant: "destructive",
        });
        setGoogleLoading(false);
        return;
      }

      if (result.redirected) return;

      const { data } = await supabase.auth.getUser();
      toast({ title: "Welcome!", description: "Redirecting to your dashboard." });
      navigate(safeNextPath || (data.user ? "/dashboard" : "/auth"), { replace: true });
    } catch (error) {
      toast({
        title: "Google sign-in failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
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
              {audience === "staff"
                ? "Staff & Admin sign in with email"
                : isLogin
                ? "Borrowers sign in with phone number"
                : "Get started with your phone number"}
            </p>
          </div>

          <div className="glass rounded-3xl p-8 shadow-card animate-slide-up">
            <Tabs value={audience} onValueChange={(v) => setAudience(v as "borrower" | "staff")} className="mb-6">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="borrower">Borrower</TabsTrigger>
                <TabsTrigger value="staff">Staff / Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="borrower" className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base mb-6 gap-2"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                  Continue with Google
                </Button>

                <div className="mb-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

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
              </TabsContent>

              <TabsContent value="staff" className="mt-6">
                <form onSubmit={handleStaffLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="staff-email" className="text-sm font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        id="staff-email"
                        type="email"
                        placeholder="you@phindu.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-11"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        id="staff-password"
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-11"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="hero" className="w-full h-12 text-base" disabled={staffLoading}>
                    {staffLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">Sign In <ArrowRight size={18} /></span>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Staff accounts are created by an administrator. Contact your admin if you don't have access.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
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

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6.1-7.5 11.1-7.5 3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8L6 32.6C9.4 39.4 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default Auth;
