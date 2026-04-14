import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BetaBadge } from "@/components/admin/BetaBadge";

const TIERS = [
  { label: "Tier 1", range: "K1,000 – K5,000", interest: "30%", duration: "10 days", lateFee: "K30/day" },
  { label: "Tier 2", range: "K5,001 – K10,000", interest: "20%", duration: "15 days", lateFee: "K30/day" },
];

export default function MarketeerTierBreakdown() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle className="text-base">Pricing Tiers</CardTitle>
        <BetaBadge featureKey="marketeer_tiers" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIERS.map((tier) => (
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
        </div>
      </CardContent>
    </Card>
  );
}
