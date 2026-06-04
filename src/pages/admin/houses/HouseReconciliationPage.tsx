import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHouseLoans, useHouseRepayments } from "@/hooks/useHouseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Receipt } from "lucide-react";

const k = (v: number) => `K${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString()}`;

export default function HouseReconciliationPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans = [] } = useHouseLoans(productCode);
  const { data: repayments = [] } = useHouseRepayments(productCode);

  const loanMap = useMemo(() => {
    const m = new Map<string, any>();
    (loans as any[]).forEach((l) => m.set(l.id, l));
    return m;
  }, [loans]);

  const repaymentMap = useMemo(() => {
    const m = new Map<string, any>();
    (repayments as any[]).forEach((r) => m.set(r.id, r));
    return m;
  }, [repayments]);

  const repaymentIds = useMemo(
    () => (repayments as any[]).map((r) => r.id),
    [repayments],
  );

  // Deposits that have been matched to this house's installments.
  const { data: deposits = [], isLoading } = useQuery({
    queryKey: ["house-reconciliation-deposits", productCode, repaymentIds.length],
    enabled: repaymentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transactions")
        .select("id, amount, reference_id, reference_type, source, notes, created_at, account_id, accounts(account_name)")
        .eq("reference_type", "repayment")
        .in("reference_id", repaymentIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Open installments still needing collection.
  const openInstallments = useMemo(
    () =>
      (repayments as any[])
        .filter((r) => ["pending", "overdue", "partial"].includes((r.status ?? "").toLowerCase()))
        .map((r) => {
          const remaining =
            Math.max(Number(r.original_amount ?? r.amount ?? 0) - Number(r.principal_paid ?? 0), 0) +
            Math.max(Number(r.penalty_amount ?? 0) - Number(r.penalty_paid ?? 0), 0);
          return { ...r, remaining };
        })
        .filter((r) => r.remaining > 0.01)
        .sort((a, b) => (a.due_date < b.due_date ? -1 : 1)),
    [repayments],
  );

  // Double-count guard: flag any installment whose matched deposits exceed its value.
  const overMatched = useMemo(() => {
    const byRepayment = new Map<string, number>();
    (deposits as any[]).forEach((d) => {
      byRepayment.set(d.reference_id, (byRepayment.get(d.reference_id) ?? 0) + Number(d.amount || 0));
    });
    const flags: Array<{ repaymentId: string; deposited: number; due: number }> = [];
    byRepayment.forEach((deposited, repaymentId) => {
      const rep = repaymentMap.get(repaymentId);
      if (!rep) return;
      const due =
        Number(rep.original_amount ?? rep.amount ?? 0) + Number(rep.penalty_amount ?? 0);
      if (deposited > due + 0.01) flags.push({ repaymentId, deposited, due });
    });
    return flags;
  }, [deposits, repaymentMap]);

  const totalMatched = (deposits as any[]).reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalOutstanding = openInstallments.reduce((s, r) => s + r.remaining, 0);

  const borrowerFor = (loanId: string) => {
    const l = loanMap.get(loanId);
    return l?.full_name || l?.email || loanId.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Receipt size={18} /> Receipt Reconciliation
        </h2>
        <p className="text-sm text-muted-foreground">
          Every recorded deposit is automatically tied to the installment it settles — preventing
          double-counting. Review matched receipts and outstanding installments below.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Matched receipts</p>
            <p className="text-xl font-bold text-success">{k(totalMatched)}</p>
            <p className="text-xs text-muted-foreground">{deposits.length} deposit(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold text-destructive">{k(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">{openInstallments.length} installment(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Double-count guard</p>
            <p className={`text-xl font-bold ${overMatched.length ? "text-destructive" : "text-success"}`}>
              {overMatched.length ? `${overMatched.length} flag(s)` : "Clean"}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> auto-protected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reconciled</p>
            <p className="text-xl font-bold">
              {totalMatched + totalOutstanding > 0
                ? Math.round((totalMatched / (totalMatched + totalOutstanding)) * 100)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground">of expected inflow</p>
          </CardContent>
        </Card>
      </div>

      {overMatched.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {overMatched.length} installment(s) have deposits exceeding their value — possible
            duplicate receipt. Review these in the loan detail and reverse any double entry.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Outstanding ({openInstallments.length})</TabsTrigger>
          <TabsTrigger value="matched">Matched receipts ({deposits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installments awaiting payment</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openInstallments.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{borrowerFor(r.loan_id)}</TableCell>
                      <TableCell className="text-sm">{r.installment_number}</TableCell>
                      <TableCell className="text-sm">
                        {r.due_date ? format(new Date(r.due_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{k(r.remaining)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <Link to={`/admin/houses/${productCode}/loans/${r.loan_id}`}>
                            Match <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {openInstallments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                        All installments are fully reconciled.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matched">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deposits matched to installments</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Installment</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(deposits as any[]).map((d) => {
                      const rep = repaymentMap.get(d.reference_id);
                      const flagged = overMatched.some((f) => f.repaymentId === d.reference_id);
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm">
                            {d.created_at ? format(new Date(d.created_at), "dd MMM yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {rep ? borrowerFor(rep.loan_id) : d.source || "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">{k(d.amount)}</TableCell>
                          <TableCell className="text-sm">
                            {rep ? (
                              <Link
                                to={`/admin/houses/${productCode}/loans/${rep.loan_id}`}
                                className="text-primary hover:underline"
                              >
                                #{rep.installment_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.accounts?.account_name || "—"}
                          </TableCell>
                          <TableCell>
                            {flagged ? (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> Over-matched
                              </Badge>
                            ) : (
                              <Badge className="text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Matched
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {deposits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          No matched receipts yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
