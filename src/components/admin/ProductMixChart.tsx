import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
  "hsl(280, 60%, 50%)",
  "hsl(30, 80%, 50%)",
];

const ProductMixChart = () => {
  const { data: mixData, isLoading } = useQuery({
    queryKey: ["product-mix-chart"],
    queryFn: async () => {
      const [loansRes, productsRes] = await Promise.all([
        supabase
          .from("loan_applications")
          .select("loan_product_id, loan_amount")
          .in("status", ["active", "disbursed", "completed"]),
        supabase.from("loan_products").select("id, name"),
      ]);

      const loans = loansRes.data || [];
      const products = productsRes.data || [];
      const productMap = new Map(products.map((p) => [p.id, p.name]));

      const grouped = new Map<string, { count: number; value: number }>();

      loans.forEach((l) => {
        const name = l.loan_product_id
          ? productMap.get(l.loan_product_id) || "Other"
          : "Unlinked";
        const existing = grouped.get(name) || { count: 0, value: 0 };
        existing.count++;
        existing.value += Number(l.loan_amount || 0);
        grouped.set(name, existing);
      });

      return Array.from(grouped.entries())
        .map(([name, data]) => ({ name, count: data.count, value: data.value }))
        .sort((a, b) => b.value - a.value);
    },
  });

  const formatCurrency = (v: number) => `K${v.toLocaleString()}`;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Product Mix</CardTitle>
        <CardDescription>Loan distribution by product</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : mixData && mixData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {mixData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No product data
            </div>
          )}
        </div>
        {/* Summary table */}
        {mixData && mixData.length > 0 && (
          <div className="mt-4 border-t border-border/50 pt-3 space-y-2">
            {mixData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{p.name}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-foreground font-medium">{p.count} loans</span>
                  <span className="text-foreground font-medium">
                    K{p.value.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductMixChart;
