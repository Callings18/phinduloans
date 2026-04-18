import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { subMonths, format } from "date-fns";
import QueryStateView from "@/components/common/QueryStateView";

const RepaymentPerformanceChart = () => {
  const { data: chartData, isLoading, isError } = useQuery({
    queryKey: ["repayment-performance-chart"],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6);

      const { data: repayments, error } = await supabase
        .from("loan_repayments")
        .select("status, due_date, amount, paid_date")
        .gte("due_date", format(sixMonthsAgo, "yyyy-MM-dd"));

      if (error) throw error;
      const allRepayments = repayments || [];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthMap = new Map<string, { onTime: number; late: number; missed: number }>();

      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthMap.set(key, { onTime: 0, late: 0, missed: 0 });
      }

      const today = new Date();

      allRepayments.forEach((r) => {
        const dueDate = new Date(r.due_date);
        const key = `${monthNames[dueDate.getMonth()]} ${dueDate.getFullYear()}`;
        const entry = monthMap.get(key);
        if (!entry) return;

        if (r.status === "paid") {
          // Check if paid on time or late
          const paidDate = r.paid_date ? new Date(r.paid_date) : dueDate;
          if (paidDate <= dueDate) {
            entry.onTime++;
          } else {
            entry.late++;
          }
        } else if (r.status === "pending" && dueDate < today) {
          entry.missed++;
        }
      });

      return Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        "On Time": data.onTime,
        Late: data.late,
        Missed: data.missed,
      }));
    },
  });

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Repayment Performance</CardTitle>
        <CardDescription>On-time vs late vs missed payments (6 months)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] min-h-[200px] sm:h-[260px] md:h-[300px]">
          <QueryStateView
            isLoading={isLoading}
            isError={isError}
            hasData={(chartData?.length ?? 0) > 0}
            loadingText="Loading repayment performance..."
            errorText="Repayment performance could not be loaded."
            emptyText="No repayment data."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Bar dataKey="On Time" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Missed" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </QueryStateView>
        </div>
      </CardContent>
    </Card>
  );
};

export default RepaymentPerformanceChart;
