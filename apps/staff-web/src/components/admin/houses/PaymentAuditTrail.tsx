import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { ScrollText, User, Banknote, RotateCcw, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

const k = (v: number) => `K${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString()}`;

const PAYMENT_EVENT_TYPES = [
  "payment_recorded",
  "payment_reversed",
  "payment_claim_submitted",
  "payment_claim_approved",
  "manual_default",
];

interface PaymentAuditTrailProps {
  loanId: string;
}

function eventMeta(type: string) {
  switch (type) {
    case "payment_recorded":
      return { label: "Payment recorded", icon: Banknote, tone: "default" as const };
    case "payment_reversed":
      return { label: "Payment reversed", icon: RotateCcw, tone: "destructive" as const };
    case "payment_claim_submitted":
      return { label: "Claim submitted", icon: ScrollText, tone: "outline" as const };
    case "payment_claim_approved":
      return { label: "Claim approved", icon: Banknote, tone: "default" as const };
    case "manual_default":
      return { label: "Marked defaulted", icon: ShieldAlert, tone: "destructive" as const };
    default:
      return { label: type.replace(/_/g, " "), icon: ScrollText, tone: "outline" as const };
  }
}

export function PaymentAuditTrail({ loanId }: PaymentAuditTrailProps) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["payment-audit-trail", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_events")
        .select("id, event_type, performed_by, reason, new_values, created_at")
        .eq("loan_id", loanId)
        .in("event_type", PAYMENT_EVENT_TYPES)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const performerIds = Array.from(
    new Set(events.map((e: any) => e.performed_by).filter(Boolean)),
  ) as string[];

  const { data: performers = {} } = useQuery({
    queryKey: ["payment-audit-performers", performerIds.sort().join(",")],
    enabled: performerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", performerIds);
      if (error) throw error;
      const map: Record<string, { full_name?: string; email?: string }> = {};
      (data ?? []).forEach((p: any) => {
        map[p.id] = { full_name: p.full_name, email: p.email };
      });
      return map;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText size={16} /> Payment Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payment activity recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
            {events.map((e: any) => {
              const meta = eventMeta(e.event_type);
              const Icon = meta.icon;
              const v = (e.new_values ?? {}) as Record<string, any>;
              const performer = e.performed_by ? performers[e.performed_by] : undefined;
              const recorder = performer?.full_name || performer?.email || "System / automated";
              const amount = Number(v.amount ?? 0);
              const principal = Number(v.principal_amount ?? 0);
              const penalty = Number(v.penalty_amount ?? 0);
              const remaining = v.remaining_balance != null ? Number(v.remaining_balance) : null;
              const method = v.payment_method as string | undefined;
              const reference = v.transaction_reference as string | undefined;
              const source =
                method === "bank_transfer"
                  ? "Bank deposit"
                  : method === "mobile_money"
                  ? "Mobile money"
                  : method === "cash"
                  ? "Cash receipt"
                  : method
                  ? method.replace(/_/g, " ")
                  : "—";
              const resultingStatus =
                e.event_type === "manual_default"
                  ? "defaulted"
                  : e.event_type === "payment_reversed"
                  ? "reopened"
                  : remaining != null && remaining <= 0.01
                  ? "completed"
                  : remaining != null
                  ? "active"
                  : null;
              const touched = Array.isArray(v.installments_touched) ? v.installments_touched : [];

              return (
                <li key={e.id} className="relative pl-7">
                  <span className="absolute left-0 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-background">
                    <Icon className="h-2 w-2 text-primary-foreground" />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.tone} className="text-xs">{meta.label}</Badge>
                      {amount > 0 && <span className="font-semibold text-sm">{k(amount)}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {e.created_at ? format(new Date(e.created_at), "dd MMM yyyy · HH:mm") : ""}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {recorder}
                    </span>
                    {method && <span>Source: {source}</span>}
                    {reference && <span>Ref: {reference}</span>}
                  </div>

                  {(principal > 0 || penalty > 0) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                      <span>Principal {k(principal)}</span>
                      {penalty > 0 && <span>Penalty {k(penalty)}</span>}
                      {touched.length > 0 && (
                        <span className="text-muted-foreground">
                          {touched.length} installment{touched.length === 1 ? "" : "s"} updated
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {remaining != null && (
                      <span className="text-muted-foreground">Balance after: {k(remaining)}</span>
                    )}
                    {resultingStatus && (
                      <Badge
                        variant={
                          resultingStatus === "completed"
                            ? "default"
                            : resultingStatus === "defaulted"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px] capitalize"
                      >
                        → {resultingStatus}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
