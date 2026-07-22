import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { Sparkles, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { borrowerAppPath, getSiteModeFromHostname } from "@/config/publicUrls";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const { user, isLoading, isStaff, signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Defense-in-depth: marketing must never render staff Auth (route should ExternalRedirect).
    if (getSiteModeFromHostname() === "marketing") {
      window.location.replace(borrowerAppPath("/auth") + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      if (isStaff) {
        navigate(safeNextPath || "/admin");
      } else {
        window.location.assign(borrowerAppPath("/auth"));
      }
    }
  }, [user, isLoading, isStaff, navigate, safeNextPath]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass rounded-3xl p-8 shadow-card">
        <div className="text-center mb-8">
          <Sparkles className="mx-auto mb-4 text-primary" size={32} />
          <h1 className="text-2xl font-bold">Staff Sign In</h1>
          <p className="text-muted-foreground mt-2 text-sm">Borrowers should use the mobile app.</p>
        </div>
        <form onSubmit={handleStaffLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="staff-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11" autoComplete="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11" autoComplete="current-password" />
            </div>
          </div>
          <Button type="submit" variant="hero" className="w-full h-12" disabled={staffLoading}>
            {staffLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <span className="flex items-center justify-center gap-2">Sign In <ArrowRight size={18} /></span>}
          </Button>
        </form>
        <div className="text-center mt-6 space-y-2">
          <Button variant="ghost" asChild><a href="/">← Back to Home</a></Button>
          <p className="text-sm text-muted-foreground"><a href={borrowerAppPath("/auth")} className="text-primary hover:underline">Open borrower app</a></p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
