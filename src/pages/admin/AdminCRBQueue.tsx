import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

type CrbRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  credit_score: number | null;
  risk_rating: string | null;
  provider: string | null;
  nrc_number: string;
  loan_application_id: string | null;
  borrower_id: string;
  error_message: string | null;
  request_type: string;
};

function maskNrc(nrc: string | null | undefined): string {
  const s = (nrc ?? "").trim();
  if (!s) return "—";
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}

const statusVariant = (s: string | null) => {
  const v = (s || "").toLowerCase();
  if (v.includes("fail") || v.includes("error")) return "destructive" as const;
  if (v.includes("pend") || v.includes("queue")) return "secondary" as const;
  if (v.includes("success") || v.includes("complete")) return "default" as const;
  return "outline" as const;
};

const AdminCRBQueue = () => {
  const { can } = usePermissions();
  const canRevealFullNrc = can("loans", "finance_approve");
  const [revealedNrcById, setRevealedNrcById] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-crb-requests"],
    queryFn: async () => {
      const { data, error: qErr } = await supabase
        .from("crb_requests")
        .select(
          "id, created_at, status, credit_score, risk_rating, provider, nrc_number, loan_application_id, borrower_id, error_message, request_type"
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (qErr) throw qErr;
      return (data ?? []) as CrbRow[];
    },
  });

  const pendingReview = useMemo(
    () =>
      rows.filter((r) => {
        const s = (r.status || "").toLowerCase();
        return s.includes("pending") || s.includes("manual") || s.includes("review");
      }).length,
    [rows]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            CRB request queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Audit trail of credit bureau checks. NRC numbers are masked by default; full values are available only to
            credit/finance approvers. Link to an application for manual review when status is{" "}
            <code className="text-xs bg-muted px-1 rounded">crb_failed</code> or pending.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Flagged / manual review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingReview}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/settings">CRB settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent requests</CardTitle>
            <CardDescription>Provider responses and scores as recorded in the database.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            {error && (
              <p className="text-destructive text-sm">
                {(error as Error).message || "Could not load CRB requests"}
              </p>
            )}
            {!isLoading && !error && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead className="min-w-[140px]">NRC</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Application</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.created_at ? format(new Date(r.created_at), "dd MMM yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span>
                            {canRevealFullNrc && revealedNrcById[r.id]
                              ? r.nrc_number
                              : maskNrc(r.nrc_number)}
                          </span>
                          {canRevealFullNrc && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() =>
                                setRevealedNrcById((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                              }
                              aria-label={revealedNrcById[r.id] ? "Hide NRC" : "Reveal full NRC"}
                            >
                              {revealedNrcById[r.id] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.request_type}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status || "unknown"}</Badge>
                      </TableCell>
                      <TableCell>{r.credit_score ?? "—"}</TableCell>
                      <TableCell>{r.risk_rating ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.provider ?? "—"}</TableCell>
                      <TableCell>
                        {r.loan_application_id ? (
                          <Link
                            to={`/admin/applications?id=${r.loan_application_id}`}
                            className="text-primary text-sm font-medium hover:underline"
                          >
                            Open application
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        No CRB requests recorded yet. Checks appear here when the CRB edge functions write to{" "}
                        <code className="text-xs">crb_requests</code>.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCRBQueue;
