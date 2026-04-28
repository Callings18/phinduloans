import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseDisbursements, useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { houseMarkDisbursementCompleted } from "@/services/repositories/houseWorkflowRepository";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { format } from "date-fns";
import { Banknote, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function HouseDisbursementsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: disbursements } = useHouseDisbursements(productCode);
  const { data: loans } = useHouseLoans(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rowAccounts, setRowAccounts] = useState<Record<string, string>>({});

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, balance, is_protected")
        .eq("is_active", true)
        .or("is_protected.is.null,is_protected.eq.false")
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const loanMap = useMemo(() => {
    const map: Record<string, any> = {};
    (loans ?? []).forEach((l: any) => { map[l.id] = l; });
    return map;
  }, [loans]);

  const pending = (disbursements ?? []).filter((d: any) => d.status !== "completed" && d.status !== "failed" && d.status !== "cancelled");
  const completed = (disbursements ?? []).filter((d: any) => d.status === "completed");

  const totalPending = pending.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  const totalDisbursed = completed.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

  const disburseMutation = useMutation({
    mutationFn: async (disbursement: any) => {
      const accountId = rowAccounts[disbursement.id] || disbursement?.source_account_id;
      if (!accountId) {
        throw new Error("Pick a funding account before disbursing");
      }
      return houseMarkDisbursementCompleted({
        disbursementId: disbursement.id,
        accountId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-disbursements", productCode] });
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      await queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
      await queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      toast({ title: "Disbursement completed and account debited" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Disbursements</h2>
        <BetaBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pending ({pending.length})</p>
              <p className="text-lg font-bold">K{totalPending.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Completed ({completed.length})</p>
              <p className="text-lg font-bold text-green-600">K{totalDisbursed.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total records</p>
              <p className="text-lg font-bold">{(disbursements ?? []).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending disbursements */}
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending disbursements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Funding account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((d: any) => {
                  const loan = loanMap[d.loan_id];
                  const chosen = rowAccounts[d.id] || d.source_account_id || "";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{loan?.full_name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">K{Number(d.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Select value={chosen} onValueChange={(v) => setRowAccounts((p) => ({ ...p, [d.id]: v }))}>
                          <SelectTrigger className={`h-7 text-xs w-44 ${!chosen ? "border-destructive" : ""}`}>
                            <SelectValue placeholder="Pick account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{a.account_name} — K{Number(a.balance).toLocaleString()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{d.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(d.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={disburseMutation.isPending || !chosen}
                          onClick={() => disburseMutation.mutate(d)}
                        >
                          Disburse now
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Completed disbursements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed disbursements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completed.map((d: any) => {
                const loan = loanMap[d.loan_id];
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{loan?.full_name || "—"}</TableCell>
                    <TableCell className="text-right font-medium">K{Number(d.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{d.disbursement_method || "N/A"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.disbursed_at ? format(new Date(d.disbursed_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.transaction_reference || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {completed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No completed disbursements.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
