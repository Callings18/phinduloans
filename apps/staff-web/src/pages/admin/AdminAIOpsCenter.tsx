import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Activity, Bot, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import { useAIOpsBriefing } from "@/hooks/useAIOpsBriefing";

function asCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

function asCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `K${value.toLocaleString()}`;
}

export default function AdminAIOpsCenter() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAIOpsBriefing();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">AI Operations Center</h1>
            <p className="text-sm text-muted-foreground">
              Read-only morning briefing and operational intelligence for staff decisions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">Observe-only v1</Badge>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh briefing"}
            </Button>
          </div>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Morning Briefing
            </CardTitle>
            <CardDescription>
              {data?.generatedAt ? `Generated ${format(new Date(data.generatedAt), "EEEE, MMM d, HH:mm")}` : "Live operational overview"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading briefing...
              </div>
            ) : isError ? (
              <div className="space-y-2 text-sm">
                <p className="text-destructive">Briefing could not be loaded.</p>
                <p className="text-muted-foreground">{(error as Error)?.message || "Please try again."}</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    Good morning. <strong>{asCount(data?.pendingApplications)}</strong> borrowers are waiting for approval.
                  </CardContent>
                </Card>
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    <strong>{asCount(data?.overdueOrFailedYesterday)}</strong> repayment issues need follow-up from yesterday.
                  </CardContent>
                </Card>
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    Available lending liquidity: <strong>{asCurrency(data?.availableLiquidity)}</strong>.
                  </CardContent>
                </Card>
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    <strong>{asCount(data?.unsignedContracts)}</strong> approved loans are still awaiting borrower signature.
                  </CardContent>
                </Card>
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    <strong>{asCount(data?.assignedPendingReviews)}</strong> assigned applications are still pending review.
                  </CardContent>
                </Card>
                <Card className="bg-card/70">
                  <CardContent className="pt-6 text-sm">
                    Approaching default watchlist: <strong>{asCount(data?.approachingDefault)}</strong> loans.
                  </CardContent>
                </Card>
                <Card className="bg-card/70 md:col-span-2 xl:col-span-3">
                  <CardContent className="pt-6 text-sm">
                    Collections trend: <strong>{data?.collectionsTrend ?? "—"}</strong>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Platform Health
            </CardTitle>
            <CardDescription>Read-only status hints from notification and operational signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Recent notification failures</span>
              <Badge variant="outline" className="border-warning/40 text-warning">
                {asCount(data?.notificationFailures)}
              </Badge>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-foreground">{data?.healthHint ?? "Loading health hints..."}</p>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CircleAlert className="h-3 w-3" />
              For deep diagnostics, open Supabase logs and Edge Function logs in your ops console.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Agents Module</CardTitle>
            <CardDescription>
              Continue to the existing agents workspace for detailed findings and manual runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin/ai-agents">
                <Bot className="mr-2 h-4 w-4" />
                Open AI Agents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
