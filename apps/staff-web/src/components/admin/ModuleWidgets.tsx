import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import {
  FileText,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

interface ModuleWidgetProps {
  title: string;
  icon: React.ElementType;
  value: number | string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  path: string;
  color: string;
  alert?: boolean;
}

const ModuleWidget = ({
  title,
  icon: Icon,
  value,
  subValue,
  trend,
  trendValue,
  path,
  color,
  alert,
}: ModuleWidgetProps) => (
  <Link
    to={path}
    className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:shadow-lg ${
      alert
        ? "border-destructive/50 bg-gradient-to-br from-destructive/10 via-card to-card hover:border-destructive"
        : "border-border/50 bg-gradient-to-br from-muted/30 via-card to-card hover:border-primary/50"
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${alert ? "text-destructive" : "text-foreground"}`}>
          {value}
        </p>
        {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
        {trend && trendValue && (
          <div className="flex items-center gap-1 mt-2">
            {trend === "up" ? (
              <TrendingUp size={12} className="text-success" />
            ) : trend === "down" ? (
              <TrendingDown size={12} className="text-destructive" />
            ) : null}
            <span
              className={`text-xs font-medium ${
                trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {trendValue}
            </span>
          </div>
        )}
      </div>
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
      >
        <Icon className="text-white" size={20} />
      </div>
    </div>
    <ArrowUpRight
      size={14}
      className="absolute bottom-3 right-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
    />
  </Link>
);

const ModuleWidgets = () => {
  const { data: moduleStats } = useQuery({
    queryKey: ["module-stats"],
    queryFn: async () => {
      const today = new Date();
      const [applications, repayments, disbursements] = await Promise.all([
        supabase.from("loan_applications").select("status", { count: "exact" }),
        supabase.from("loan_repayments").select("status, due_date, amount"),
        supabase.from("disbursements").select("status", { count: "exact" }).eq("status", "pending"),
      ]);

      const allRepayments = repayments.data || [];
      const overdueRepayments = allRepayments.filter(
        (r) => r.status === "pending" && new Date(r.due_date) < today
      );
      const overdueAmount = overdueRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
      const pendingApps = (applications.data || []).filter((a) => a.status === "pending").length;
      const underReviewApps = (applications.data || []).filter((a) => a.status === "under_review").length;

      return {
        pendingApplications: pendingApps,
        underReviewApplications: underReviewApps,
        pendingDisbursements: disbursements.count || 0,
        overdueCount: overdueRepayments.length,
        overdueAmount,
      };
    },
  });

  // Live updates for the widget tiles
  useRealtimeInvalidate(
    ["loan_applications", "loan_repayments", "disbursements"],
    [["module-stats"]],
    "module-widgets-realtime",
  );

  const widgets: ModuleWidgetProps[] = [
    {
      title: "Pending Applications",
      icon: FileText,
      value: moduleStats?.pendingApplications || 0,
      subValue: `${moduleStats?.underReviewApplications || 0} under review`,
      trend: "up",
      trendValue: "Needs attention",
      path: "/admin/applications?status=pending",
      color: "from-primary to-primary/80",
    },
    {
      title: "Pending Disbursements",
      icon: CreditCard,
      value: moduleStats?.pendingDisbursements || 0,
      subValue: "Awaiting processing",
      path: "/admin/disbursements?status=pending",
      color: "from-purple-500 to-pink-600",
    },
    {
      title: "Overdue Payments",
      icon: AlertTriangle,
      value: moduleStats?.overdueCount || 0,
      subValue: `K${(moduleStats?.overdueAmount || 0).toLocaleString()} total`,
      path: "/admin/repayments",
      color: "from-destructive to-red-600",
      alert: (moduleStats?.overdueCount || 0) > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {widgets.map((widget) => (
        <ModuleWidget key={widget.title} {...widget} />
      ))}
    </div>
  );
};

export default ModuleWidgets;
