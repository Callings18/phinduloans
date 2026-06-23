import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@phinduloans/shared/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { subMonths, format } from "date-fns";
import QueryStateView from "@phinduloans/shared/components/common/QueryStateView";

const DisbursementTrendsChart = () => {
  const { data: chartData, isLoading, isError } = useQuery({
    queryKey: ["disbursement-trends-chart"],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6);

      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, loan_amount, disbursed_at")
        .in("status", ["active", "disbursed", "completed"])
        .not("disbursed_at", "is", null)
        .gte("disbursed_at", sixMonthsAgo.toISOString());

      if (error) throw error;
      const loans = data || [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthMap = new Map<string, { count: number; amount: number }>();

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthMap.set(key, { count: 0, amount: 0 });
      }

      loans.forEach((l) => {
        if (!l.disbursed_at) return;
        const d = new Date(l.disbursed_at);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        const entry = monthMap.get(key);
        if (entry) {
          entry.count++;
          entry.amount += Number(l.loan_amount || 0);
        }
      });

      return Array.from(monthMap.entries()).map(([month, d]) => ({
        month,
        "Loans Disbursed": d.count,
        "Amount (K)": d.amount,
      }));
    },
  });

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Disbursement Trends</CardTitle>
        <CardDescription>Volume &amp; value over last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] min-h-[200px] sm:h-[260px] md:h-[300px]">
          <QueryStateView
            isLoading={isLoading}
            isError={isError}
            hasData={(chartData?.length ?? 0) > 0}
            loadingText="Loading disbursement trends..."
            errorText="Disbursement trends could not be loaded."
            emptyText="No disbursement data."
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `K${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) =>
                    name === "Amount (K)" ? `K${value.toLocaleString()}` : value
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="Loans Disbursed"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Amount (K)"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--success))", r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </QueryStateView>
        </div>
      </CardContent>
    </Card>
  );
};

export default DisbursementTrendsChart;
