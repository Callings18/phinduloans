import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Skeleton } from "@phinduloans/shared/components/ui/skeleton";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Banknote,
  Calculator,
  AlertTriangle,
  Undo2,
  FileText,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
import { Button } from "@phinduloans/shared/components/ui/button";

interface LoanHistoryTimelineProps {
  loanId: string;
  onViewLoan?: (loanId: string) => void;
}

const EVENT_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  reloan: { label: "Reloan", icon: ArrowRight, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  top_up: { label: "Top-Up", icon: Plus, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  restructure: { label: "Restructure", icon: RefreshCw, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  disbursement: { label: "Disbursement", icon: Banknote, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  early_settlement: { label: "Early Settlement", icon: Calculator, color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  penalty_applied: { label: "Penalty Applied", icon: AlertTriangle, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  payment_reversal: { label: "Payment Reversal", icon: Undo2, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `K${Number(amount).toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DiffValue({ label, before, after, isCurrency = true }: { label: string; before: any; after: any; isCurrency?: boolean }) {
  if (before == null && after == null) return null;
  const changed = before !== after;
  const beforeStr = isCurrency ? formatCurrency(before) : String(before ?? "—");
  const afterStr = isCurrency ? formatCurrency(after) : String(after ?? "—");

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-28 shrink-0">{label}:</span>
      {changed ? (
        <>
          <span className="line-through text-muted-foreground/60">{beforeStr}</span>
          <ArrowRight size={10} className="text-muted-foreground" />
          <span className="font-medium text-foreground">{afterStr}</span>
          {isCurrency && before != null && after != null && (
            <span className={`text-[10px] ${Number(after) > Number(before) ? "text-green-400" : "text-red-400"}`}>
              {Number(after) > Number(before) ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">{afterStr}</span>
      )}
    </div>
  );
}

export default function LoanHistoryTimeline({ loanId, onViewLoan }: LoanHistoryTimelineProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["loan-events", loanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_events" as any)
        .select("*")
        .eq("loan_id", loanId)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!loanId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText size={40} className="text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-sm">No loan actions recorded yet.</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Actions like Top-Up, Restructure, and Reloan will appear here with full before/after details.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-5 top-4 bottom-4 w-px bg-border" />

      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.event_type] || {
          label: event.event_type,
          icon: FileText,
          color: "bg-muted text-muted-foreground border-border",
        };
        const Icon = config.icon;
        const prev = (event.previous_values as Record<string, any>) || {};
        const next = (event.new_values as Record<string, any>) || {};

        return (
          <div key={event.id} className="relative flex gap-4 pb-6">
            {/* Timeline dot */}
            <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${config.color}`}>
              <Icon size={16} />
            </div>

            {/* Content */}
            <Card className="flex-1 border-border/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(event.performed_at), "dd MMM yyyy, HH:mm")}
                    </span>
                  </div>
                  {event.amount != null && (
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(event.amount)}
                    </span>
                  )}
                </div>

                {/* Reason */}
                {event.reason && (
                  <p className="text-xs text-muted-foreground mb-2 italic">"{event.reason}"</p>
                )}

                {/* Before/After diffs */}
                <div className="space-y-1">
                  <DiffValue label="Principal" before={prev.principal} after={next.principal} />
                  <DiffValue label="Interest Rate" before={prev.interest_rate ? `${prev.interest_rate}%` : null} after={next.interest_rate ? `${next.interest_rate}%` : null} isCurrency={false} />
                  <DiffValue label="Term" before={prev.term ? `${prev.term} ${prev.term_unit || 'months'}` : null} after={next.term ? `${next.term} ${next.term_unit || 'months'}` : null} isCurrency={false} />
                  <DiffValue label="Total Repayment" before={prev.total_repayment} after={next.total_repayment} />
                  <DiffValue label="Monthly Payment" before={prev.monthly_payment} after={next.monthly_payment} />
                </div>

                {/* Fees info */}
                {event.fees_charged > 0 && (
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>Fees: {formatCurrency(event.fees_charged)}</span>
                    {event.net_amount != null && <span>Net: {formatCurrency(event.net_amount)}</span>}
                  </div>
                )}

                {/* Link to new loan (reloans) */}
                {event.new_loan_id && onViewLoan && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-2 text-xs"
                    onClick={() => onViewLoan(event.new_loan_id)}
                  >
                    <ExternalLink size={12} className="mr-1" />
                    View new loan →
                  </Button>
                )}

                {/* Document link */}
                {event.document_url && (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-1 text-xs"
                    onClick={() => window.open(event.document_url, "_blank")}
                  >
                    <FileText size={12} className="mr-1" />
                    View amended document
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
