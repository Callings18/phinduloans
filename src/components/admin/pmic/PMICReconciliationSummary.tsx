import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { differenceInHours, parseISO } from "date-fns";
import { AlertTriangle, FileWarning, RefreshCw } from "lucide-react";
import type { PMICException, PMICSubmission } from "@/hooks/usePMIC";

const SLA_HOURS = 72;

interface PMICReconciliationSummaryProps {
  submissions: PMICSubmission[];
  exceptions: PMICException[];
  onOpenExceptionsTab: () => void;
}

const PMICReconciliationSummary = ({
  submissions,
  exceptions,
  onOpenExceptionsTab,
}: PMICReconciliationSummaryProps) => {
  const failedSubmissions = useMemo(
    () => submissions.filter((s) => s.status === "failed" || s.status === "rejected"),
    [submissions]
  );

  const staleOpenExceptions = useMemo(() => {
    const now = Date.now();
    return exceptions.filter((e) => {
      if (e.exception_status !== "open" && e.exception_status !== "investigating") return false;
      const t = e.created_at ? parseISO(e.created_at).getTime() : now;
      return differenceInHours(now, t) >= SLA_HOURS;
    });
  }, [exceptions]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Reconciliation & SLA
            </CardTitle>
            <CardDescription>
              Failed submissions and exceptions open longer than {SLA_HOURS} hours (operational review).
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onOpenExceptionsTab}>
            Open exceptions tab
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/50 p-4 flex items-start gap-3">
          <FileWarning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Failed / rejected submissions</p>
            <p className="text-2xl font-bold">{failedSubmissions.length}</p>
            <p className="text-xs text-muted-foreground">Re-export or correct files before the next employer cycle.</p>
          </div>
        </div>
        <div className="rounded-lg border border-border/50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              Exceptions past SLA
              {staleOpenExceptions.length > 0 && (
                <Badge variant="destructive">{staleOpenExceptions.length}</Badge>
              )}
            </p>
            <p className="text-2xl font-bold">{staleOpenExceptions.length}</p>
            <p className="text-xs text-muted-foreground">Open or investigating longer than {SLA_HOURS}h.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PMICReconciliationSummary;
