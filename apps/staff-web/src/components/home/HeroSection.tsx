import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
  ArrowRight,
  Shield,
  Clock,
  CheckCircle,
  Loader2,
  Banknote,
  Users,
  Repeat,
  FileCheck,
  TrendingUp,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import type { LucideIcon } from "lucide-react";
import { borrowerAppPath } from "@/config/publicUrls";

type Stat = { value: string; label: string; icon: LucideIcon };

const FUNDED_STATUSES = ["approved", "disbursed", "active", "completed", "defaulted"];

const HeroSection = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: async (): Promise<Stat[]> => {
      const [disbursements, applications, profiles] = await Promise.all([
        supabase.from("disbursements").select("amount").eq("status", "completed"),
        supabase.from("loan_applications").select("status, user_id"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      const totalDisbursed = disbursements.data?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      const apps = applications.data ?? [];
      const totalApps = apps.length;
      const fundedApps = apps.filter((l) => FUNDED_STATUSES.includes(l.status));
      const approvedApps = fundedApps.length;
      const approvalRate = totalApps > 0 ? Math.round((approvedApps / totalApps) * 100) : 98;

      // Returning borrowers: distinct users with 2+ funded loans.
      const loansPerUser = new Map<string, number>();
      for (const l of fundedApps) {
        if (!l.user_id) continue;
        loansPerUser.set(l.user_id, (loansPerUser.get(l.user_id) || 0) + 1);
      }
      let returningBorrowers = 0;
      loansPerUser.forEach((count) => {
        if (count >= 2) returningBorrowers += 1;
      });

      // Format total disbursed.
      let formattedDisbursed = "K0";
      if (totalDisbursed >= 1_000_000) {
        formattedDisbursed = `K${(totalDisbursed / 1_000_000).toFixed(1)}M+`;
      } else if (totalDisbursed >= 1_000) {
        formattedDisbursed = `K${(totalDisbursed / 1_000).toFixed(0)}K+`;
      } else {
        formattedDisbursed = `K${totalDisbursed}+`;
      }

      return [
        { value: formattedDisbursed, label: "Loans Disbursed", icon: Banknote },
        { value: `${approvedApps.toLocaleString()}+`, label: "Loans Given", icon: FileCheck },
        { value: `${returningBorrowers.toLocaleString()}+`, label: "Returning Borrowers", icon: Repeat },
        { value: `${(profiles.count || 0).toLocaleString()}+`, label: "Happy Customers", icon: Users },
        { value: `${approvalRate}%`, label: "Approval Rate", icon: TrendingUp },
        { value: "24hrs", label: "Avg. Approval Time", icon: Clock },
      ];
    },
    staleTime: 1000 * 30,
  });

  // Keep the portfolio numbers live: refresh whenever loans or disbursements change.
  useEffect(() => {
    const channel = supabase
      .channel("landing-stats-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_applications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["landing-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "disbursements" }, () => {
        queryClient.invalidateQueries({ queryKey: ["landing-stats"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <section className="relative min-h-screen gradient-hero overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 pt-32 pb-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 animate-fade-in">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Fast Loan Approvals in 24 Hours</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-slide-up">
            Money When You{" "}
            <span className="text-gradient">Need It</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Get quick, hassle-free personal and salary loans with competitive rates.
            Apply online in minutes and receive funds directly to your mobile money.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="lg" asChild>
              <a href={borrowerAppPath("/auth?mode=signup")}>
                Get Started
                <ArrowRight size={20} />
              </a>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link to="/calculator">
                Calculate Your Loan
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <Clock className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">24hr Approval</p>
                <p className="text-muted-foreground text-sm">Quick decisions</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <Shield className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">100% Secure</p>
                <p className="text-muted-foreground text-sm">Your data is safe</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <CheckCircle className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">Easy Process</p>
                <p className="text-muted-foreground text-sm">Apply online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live portfolio stats */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8 animate-fade-in">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Live portfolio · updated in real time</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats?.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="group relative text-center glass rounded-2xl px-4 py-6 border border-primary/10 shadow-glow animate-scale-in transition-transform duration-300 hover:-translate-y-1 hover:border-primary/30"
                    style={{ animationDelay: `${0.4 + index * 0.08}s` }}
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary animate-pulse-glow">
                      <Icon size={20} />
                    </div>
                    <p className="text-2xl md:text-3xl font-bold text-gradient drop-shadow-[0_0_12px_hsl(var(--primary)/0.45)]">
                      {stat.value}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1.5">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
