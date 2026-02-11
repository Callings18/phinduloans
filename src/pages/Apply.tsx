import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, UserPlus, Shield, Clock, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const Apply = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null; // Will redirect

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Apply for a Loan
            </h1>
            <p className="text-muted-foreground text-lg">
              To get started with your loan application, please log in or create an account first. You'll complete your KYC and apply from your personal dashboard.
            </p>
          </div>

          {/* Steps overview */}
          <div className="grid gap-4 mb-10">
            {[
              { icon: UserPlus, title: "1. Create Account", desc: "Sign up with your email and verify your identity" },
              { icon: FileText, title: "2. Complete KYC", desc: "Fill in your personal, financial, and employment details" },
              { icon: Shield, title: "3. Submit Application", desc: "Choose a loan product and apply directly from your dashboard" },
              { icon: Clock, title: "4. Get Approved", desc: "Track your application status in real-time" },
            ].map((step, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="hero" asChild className="gap-2">
              <Link to="/auth?mode=signup">
                <UserPlus size={18} />
                Create Account
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="gap-2">
              <Link to="/auth">
                <LogIn size={18} />
                Log In
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Apply;
