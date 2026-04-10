import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneAuthForm } from "@/components/auth/PhoneAuthForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, User, ArrowRight, Sparkles, Phone, KeyRound } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
});

type LoginMode = "password" | "email_otp" | "phone_otp";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? false : true;
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;
  
  const [isLogin, setIsLogin] = useState(initialMode);
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, sendOtp, user, isLoading, isStaff } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(safeNextPath || (isStaff ? "/admin" : "/dashboard"));
    }
  }, [user, isLoading, isStaff, navigate, safeNextPath]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ email, password, fullName });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Email OTP mode - send magic link via Supabase native email
    if (isLogin && loginMode === "email_otp") {
      const input = email.trim();
      if (!input) {
        setErrors({ email: "Enter your email address" });
        return;
      }
      setIsSubmitting(true);
      try {
        const { error } = await sendOtp(input);
        if (error) {
          toast({
            title: "Sign-in link failed",
            description: error.message,
            variant: "destructive",
          });
          setErrors({ email: error.message });
        } else {
          setOtpSentTo(input);
          toast({
            title: "Check your email",
            description: "We sent you a sign-in link. Click it to log in.",
          });
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Login Failed",
            description: error.message === "Invalid login credentials" 
              ? "Invalid email or password. Please try again."
              : error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully logged in.",
          });
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email is already registered. Please log in instead.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Signup Failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Account Created!",
            description: "Welcome to Phindu Credit Solutions.",
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneAuthSuccess = (userId?: string) => {
    toast({
      title: isLogin ? "Welcome back!" : "Account Created!",
      description: isLogin ? "You've successfully logged in." : "Welcome to Phindu Credit Solutions.",
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
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
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
                ? "Sign in to manage your loans" 
                : "Get started with your financial journey"}
            </p>
          </div>

          {/* Auth Form */}
          <div className="glass rounded-3xl p-8 shadow-card animate-slide-up">
            {/* Login mode selector - only show for login */}
            {isLogin && (
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50 mb-6">
                <button
                  type="button"
                  onClick={() => { setLoginMode("password"); setErrors({}); setOtpSentTo(null); }}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${loginMode === "password" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Lock size={14} />
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode("email_otp"); setErrors({}); setOtpSentTo(null); }}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${loginMode === "email_otp" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Mail size={14} />
                  Email Link
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode("phone_otp"); setErrors({}); setOtpSentTo(null); }}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${loginMode === "phone_otp" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Phone size={14} />
                  SMS OTP
                </button>
              </div>
            )}

            {/* Phone OTP mode - uses ExciteSMS via edge functions */}
            {isLogin && loginMode === "phone_otp" ? (
              <PhoneAuthForm
                purpose="login"
                onSuccess={handlePhoneAuthSuccess}
                onSwitchToEmail={() => { setLoginMode("password"); setErrors({}); }}
              />
            ) : otpSentTo ? (
              <div className="space-y-4 text-center">
                <p className="text-muted-foreground">
                  We sent a sign-in link to <strong>{otpSentTo}</strong>. Click the link in your email to log in.
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={() => { setOtpSentTo(null); setErrors({}); }}>
                  Use a different email
                </Button>
              </div>
            ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-11"
                    />
                  </div>
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  {isLogin && loginMode === "email_otp" ? "Email Address" : "Email Address"}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Show password field for password login and signup */}
              {(loginMode === "password" || !isLogin) && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11"
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
              )}

              <Button 
                type="submit" 
                variant="hero" 
                className="w-full h-12 text-base"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    <span>Please wait...</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    {isLogin
                      ? (loginMode === "email_otp" ? "Send sign-in link" : "Sign In")
                      : "Create Account"}
                    <ArrowRight size={18} />
                  </span>
                )}
              </Button>
            </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    const nextLogin = !isLogin;
                    setIsLogin(nextLogin);
                    setLoginMode("password");
                    setErrors({});
                    setOtpSentTo(null);
                    if (nextLogin) {
                      navigate("/auth", { replace: true });
                    } else {
                      navigate("/auth?mode=signup", { replace: true });
                    }
                  }}
                  className="ml-2 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </div>

          {/* Back to home */}
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
