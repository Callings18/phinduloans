import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { Skeleton } from "@phinduloans/shared/components/ui/skeleton";
import { parseMarketeerTiers } from "@phinduloans/shared/lib/marketeerCalculations";

export default function MarketeerTierBreakdown() {
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["marketeer-pricing-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("pricing_tiers, late_payment_penalty_percent, late_fee_fixed_amount")
        .eq("product_code", "MARKETEER")
        .maybeSingle();
      if (error) throw error;
      const parsed = parseMarketeerTiers(data?.pricing_tiers as unknown[]);
      return parsed.map((t, i) => ({
        label: `Tier ${i + 1}`,
        range: `K${t.minPrincipal.toLocaleString()} – K${t.maxPrincipal.toLocaleString()}`,
        interest: `${t.interestPercent}%`,
        duration: `${t.durationDays} business days`,
        lateFee: data?.late_fee_fixed_amount
          ? `K${Number(data.late_fee_fixed_amount).toLocaleString()}/day`
          : `${data?.late_payment_penalty_percent ?? 5}%`,
      }));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing Tiers</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="text-base">Pricing Tiers</CardTitle>
        <BetaBadge />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(tiers ?? []).map((tier) => (
            <div key={tier.label} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{tier.label}</span>
                <Badge variant="outline">{tier.range}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Interest</p>
                  <p className="font-medium">{tier.interest}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Duration</p>
                  <p className="font-medium">{tier.duration}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Late fee</p>
                  <p className="font-medium text-destructive">{tier.lateFee}</p>
                </div>
              </div>
            </div>
          ))}
          {(tiers ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2">No pricing tiers configured for this product.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
