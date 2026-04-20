import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";

interface Props {
  monthlyIncome?: number | null;
  hasActiveLoan: boolean;
  onApply: () => void;
}

/**
 * Quick "what could I borrow?" widget shown on the home tab.
 * Conservative DTI-based estimate (40% of monthly income × 6 months) — purely indicative.
 * Actual eligibility is determined by the full application + admin review.
 */
export default function EligibilityWidget({ monthlyIncome, hasActiveLoan, onApply }: Props) {
  const income = Number(monthlyIncome || 0);
  if (!income || income <= 0) return null;

  // Indicative max: 40% of monthly income capped over 6-month term
  const maxIndicative = Math.round((income * 0.4 * 6) / 100) * 100;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 shadow-card">
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-primary font-semibold">Indicative eligibility</p>
            <h3 className="text-sm font-semibold text-foreground">
              You could qualify for up to <span className="text-primary">K{maxIndicative.toLocaleString()}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Based on your declared monthly income. Final amount is set after admin review of your application and KYC.
            </p>
          </div>
        </div>
        {!hasActiveLoan && (
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground hover:opacity-90 h-8 px-3 text-xs shrink-0"
            onClick={onApply}
          >
            <Sparkles size={12} className="mr-1" /> Apply
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
