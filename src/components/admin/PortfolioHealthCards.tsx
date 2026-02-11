import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, Percent, Banknote, Activity } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";

const PortfolioHealthCards = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio-health-kpis"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const [loansRes, repaymentsRes] = await Promise.all([
        supabase
          .from("loan_applications")
          .select("id, loan_amount, status, total_repayment")
          .in("status", ["active", "disbursed"]),
        supabase
          .from("loan_repayments")
          .select("id, amount, status, due_date, loan_id"),
      ]);

      const activeLoans = loansRes.data || [];
      const allRepayments = repaymentsRes.data || [];

      // Total Portfolio Value
      const totalPortfolio = activeLoans.reduce(
        (sum, l) => sum + Number(l.loan_amount || 0),
        0
      );

      // Active Loans Count
      const activeCount = activeLoans.length;

      // PAR 30: loans with ANY repayment overdue 30+ days / total portfolio
      const today = now.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const pendingRepayments = allRepayments.filter((r) => r.status === "pending");

      // Find loans that have at least one repayment overdue 30+ days
      const loansWith30DaysOverdue = new Set<string>();
      pendingRepayments.forEach((r) => {
        const dueDate = new Date(r.due_date).getTime();
        if (today - dueDate >= thirtyDaysMs) {
          loansWith30DaysOverdue.add(r.loan_id);
        }
      });

      // Sum principal of those loans
      const par30Amount = activeLoans
        .filter((l) => loansWith30DaysOverdue.has(l.id))
        .reduce((sum, l) => sum + Number(l.loan_amount || 0), 0);

      const par30Percent =
        totalPortfolio > 0 ? ((par30Amount / totalPortfolio) * 100).toFixed(1) : "0.0";

      // Collection Rate: paid this month / due this month
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");

      const dueThisMonth = allRepayments.filter(
        (r) => r.due_date >= monthStartStr && r.due_date <= monthEndStr
      );
      const totalDueAmount = dueThisMonth.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );
      const collectedThisMonth = dueThisMonth
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const collectionRate =
        totalDueAmount > 0
          ? ((collectedThisMonth / totalDueAmount) * 100).toFixed(1)
          : "0.0";

      return {
        totalPortfolio,
        activeCount,
        par30Percent,
        par30Amount,
        collectionRate,
        collectedThisMonth,
        totalDueAmount,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/80 animate-pulse">
            <CardContent className="p-6 h-28" />
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Portfolio Value",
      value: `K${(data?.totalPortfolio || 0).toLocaleString()}`,
      sub: "Outstanding principal",
      icon: Banknote,
      gradient: "from-primary to-primary/80",
    },
    {
      label: "PAR 30",
      value: `${data?.par30Percent || 0}%`,
      sub: `K${(data?.par30Amount || 0).toLocaleString()} at risk`,
      icon: ShieldAlert,
      gradient: "from-destructive to-red-600",
      alert: Number(data?.par30Percent || 0) > 5,
    },
    {
      label: "Collection Rate",
      value: `${data?.collectionRate || 0}%`,
      sub: `K${(data?.collectedThisMonth || 0).toLocaleString()} / K${(data?.totalDueAmount || 0).toLocaleString()}`,
      icon: Percent,
      gradient: "from-success to-emerald-600",
    },
    {
      label: "Active Loans",
      value: data?.activeCount || 0,
      sub: "Currently servicing",
      icon: Activity,
      gradient: "from-info to-blue-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={`relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card group hover:border-primary/50 transition-all duration-300 ${
            c.alert ? "border-destructive/50" : ""
          }`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">
                  {c.label}
                </p>
                <p
                  className={`text-3xl font-bold ${
                    c.alert ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {c.value}
                </p>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg`}
              >
                <c.icon className="text-white" size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PortfolioHealthCards;
