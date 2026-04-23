import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Percent, Scale, MapPin, Banknote, Clock, ShieldAlert } from "lucide-react";

const PERIOD_LABEL: Record<string, string> = {
  per_day: "/ day",
  per_week: "/ week",
  per_month: "/ month",
  per_year: "/ year",
  per_loan: "/ loan",
  monthly: "/ month",
  daily: "/ day",
  weekly: "/ week",
  yearly: "/ year",
};

const DEDUCTION_LABEL: Record<string, string> = {
  upfront_net: "Upfront (net disbursement)",
  added_to_repayment: "Added to repayment",
  none: "None",
};

export default function HouseProductConfigCard({ productCode }: { productCode: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["house-product-config", productCode],
    enabled: Boolean(productCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select(
          "name, interest_rate, interest_period, legal_fee_percent, legal_fee_deduction_mode, processing_fee_percent, late_payment_penalty_percent, late_fee_fixed_amount, min_amount, max_amount, min_term_months, max_term_months, term_unit, eligible_locations",
        )
        .eq("product_code", productCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Product configuration</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const periodLabel = PERIOD_LABEL[data.interest_period as string] ?? "";
  const legalPct = Number(data.legal_fee_percent ?? 0);
  const legalMode = (data.legal_fee_deduction_mode as string) ?? "none";
  const procPct = Number(data.processing_fee_percent ?? 0);
  const lateFixed = data.late_fee_fixed_amount ? Number(data.late_fee_fixed_amount) : null;
  const latePct = Number(data.late_payment_penalty_percent ?? 0);
  const locations = (data.eligible_locations as string[] | null) ?? null;
  const termUnit = (data as { term_unit?: string }).term_unit ?? "months";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Product configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <Percent className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Interest</p>
              <p className="font-semibold">
                {Number(data.interest_rate ?? 0)}% <span className="text-xs text-muted-foreground">{periodLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Legal fee</p>
              <p className="font-semibold">
                {legalPct > 0 ? `${legalPct}%` : "Not set"}
              </p>
              <p className="text-xs text-muted-foreground">{DEDUCTION_LABEL[legalMode] ?? legalMode}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Processing fee</p>
              <p className="font-semibold">{procPct > 0 ? `${procPct}%` : "—"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Late fee</p>
              <p className="font-semibold text-destructive">
                {lateFixed ? `K${lateFixed.toLocaleString()}/day` : `${latePct}%`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Amount range</p>
              <p className="font-semibold">
                K{Number(data.min_amount ?? 0).toLocaleString()} – K{Number(data.max_amount ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Term</p>
              <p className="font-semibold">
                {data.min_term_months}–{data.max_term_months} {termUnit}
              </p>
            </div>
          </div>

          {locations && locations.length > 0 ? (
            <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Eligible locations</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {locations.map((l) => (
                    <Badge key={l} variant="outline">{l}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {legalPct > 0 && legalMode === "upfront_net" ? (
          <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
            Borrower receives loan amount minus {legalPct}% legal fee on disbursement, but repays the full amount.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
