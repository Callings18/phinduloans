import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import {
  fetchPhinduCreditCheck,
  ratingLabel,
  type PhinduRating,
  type PhinduResult,
} from "@/utils/phinduCreditCheck";

interface PhinduCRBCardProps {
  userId: string | null | undefined;
  requestedAmount?: number | null;
  excludeLoanId?: string | null;
  /** Compact removes the long reason list (useful inside dialogs). */
  compact?: boolean;
}

const ratingStyles: Record<PhinduRating, string> = {
  excellent: "bg-success/20 text-success border-success/30",
  good: "bg-info/20 text-info border-info/30",
  fair: "bg-warning/20 text-warning border-warning/30",
  poor: "bg-destructive/20 text-destructive border-destructive/30",
  new: "bg-muted text-muted-foreground border-border",
};

const decisionStyles: Record<PhinduResult["decision"], string> = {
  approve: "bg-success/20 text-success border-success/30",
  review: "bg-warning/20 text-warning border-warning/30",
  decline: "bg-destructive/20 text-destructive border-destructive/30",
};

const formatK = (n: number) => `K${(n || 0).toLocaleString()}`;

const scoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-info";
  if (score >= 40) return "text-warning";
  return "text-destructive";
};

export function PhinduCRBCard({
  userId,
  requestedAmount = null,
  excludeLoanId = null,
  compact = false,
}: PhinduCRBCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["phindu-crb", userId, requestedAmount, excludeLoanId],
    enabled: Boolean(userId),
    queryFn: () =>
      fetchPhinduCreditCheck(supabase, {
        userId: userId as string,
        requestedAmount,
        excludeLoanId,
      }),
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Phindu CRB — Credit Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!userId ? (
          <p className="text-sm text-muted-foreground">No borrower linked to this loan.</p>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">
            Could not compute the credit performance check. Try again shortly.
          </p>
        ) : (
          <>
            {/* Score + rating */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" /> Performance score
                </p>
                <p className={`text-4xl font-bold ${scoreColor(data.score)}`}>
                  {data.score}
                  <span className="text-base text-muted-foreground font-normal">/100</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline" className={ratingStyles[data.rating]}>
                  {ratingLabel(data.rating)}
                </Badge>
                <Badge variant="outline" className={decisionStyles[data.decision]}>
                  {data.decision === "approve" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {data.decision === "review" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {data.decision === "decline" && <XCircle className="h-3 w-3 mr-1" />}
                  {data.decision === "approve"
                    ? "Approve"
                    : data.decision === "review"
                      ? "Manual review"
                      : "Decline / reduce"}
                </Badge>
              </div>
            </div>

            <Progress value={data.score} className="h-2" />

            {/* Metric grid */}
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Metric
                label="On-time rate"
                value={`${Math.round(data.metrics.onTimeRate * 100)}%`}
                good={data.metrics.onTimeRate >= 0.9}
              />
              <Metric
                label="Late payments"
                value={`${data.metrics.latePayments}`}
                good={data.metrics.latePayments === 0}
              />
              <Metric
                label="Worst delinquency"
                value={`${data.metrics.maxDaysLate}d`}
                good={data.metrics.maxDaysLate === 0}
              />
              <Metric
                label="Loans repaid"
                value={`${data.metrics.completedLoans}`}
                good={data.metrics.completedLoans > 0}
              />
              <Metric
                label="Currently overdue"
                value={`${data.metrics.currentlyOverdue}`}
                good={data.metrics.currentlyOverdue === 0}
              />
              <Metric
                label="Defaults"
                value={`${data.metrics.defaultedLoans}`}
                good={data.metrics.defaultedLoans === 0}
              />
              <Metric
                label="Write-offs"
                value={`${data.metrics.writeOffs}`}
                good={data.metrics.writeOffs === 0}
              />
              <Metric
                label="Prior loans"
                value={`${data.metrics.totalLoans}`}
                good
              />
            </div>

            {/* Eligibility / recommendation */}
            <div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Recommended lending ceiling
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reference principal</span>
                <strong>{formatK(data.referencePrincipal)}</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Eligible cap</span>
                <strong>{formatK(data.eligibleCap)}</strong>
              </div>
              {data.requestedAmount != null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requested</span>
                    <strong>{formatK(data.requestedAmount)}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">Recommended amount</span>
                    <strong className={scoreColor(data.score)}>
                      {formatK(data.recommendedAmount || 0)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {/* Reasons */}
            {!compact && data.reasons.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/50 p-2">
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className={`text-base font-semibold ${good ? "text-foreground" : "text-warning"}`}>
        {value}
      </p>
    </div>
  );
}

export default PhinduCRBCard;
