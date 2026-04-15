import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { houseSetLoanStatus } from "@/services/repositories/houseWorkflowRepository";
import { recordLoanPayment } from "@/services/repositories/houseWorkflowRepository";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { format } from "date-fns";
import { BetaBadge } from "@/components/admin/BetaBadge";

export default function HouseLoanDetailPage() {
  const { productCode = "", loanId = "" } = useParams<{ productCode: string; loanId: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const loan = useMemo(() => (loans ?? []).find((l: any) => l.id === loanId), [loans, loanId]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: repayments = [] } = useQuery({
    queryKey: ["house-loan-repayments", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, amount, due_date, status, installment_number, principal_paid, paid_date, payment_method")
        .eq("loan_id", loanId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => houseSetLoanStatus(loanId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "Loan updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      return recordLoanPayment({ repaymentId, amount, paymentMethod: "cash" });
    },
    onSuccess: (receipt) => {
      queryClient.invalidateQueries({ queryKey: ["house-loan-repayments", loanId] });
      queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "✅ Payment recorded", description: `Receipt: ${receipt?.receipt_no}` });
      if (receipt?.receipt_no) {
        downloadRepaymentReceipt({
          borrowerName: receipt.borrower_name || "",
          borrowerPhone: receipt.borrower_phone || "",
          borrowerEmail: receipt.borrower_email || "",
          loanReference: loanId.slice(0, 8),
          loanAmount: receipt.loan_amount || 0,
          repaymentAmount: receipt.repayment_amount || 0,
          paymentDate: new Date().toISOString(),
          paymentMethod: receipt.payment_method || "cash",
          transactionReference: receipt.receipt_no || "",
          installmentNumber: receipt.installment_number || 0,
          totalInstallments: receipt.total_installments || 0,
          totalPaid: receipt.total_paid || 0,
          outstandingBalance: receipt.outstanding_balance || 0,
        });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
    },
  });

  if (!loan) return <p className="text-sm text-muted-foreground">Loan not found.</p>;

  const totalPaid = repayments.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0);
  const outstanding = Math.max(Number(loan.total_repayment || loan.loan_amount || 0) - totalPaid, 0);
  const paidCount = repayments.filter((r: any) => r.status === "paid").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">Loan detail <BetaBadge /></CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Borrower</p>
            <p className="font-medium">{loan.full_name || loan.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="font-medium">K{Number(loan.loan_amount || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total repayment</p>
            <p className="font-medium">K{Number(loan.total_repayment || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={loan.status === "active" ? "default" : "secondary"}>{loan.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid / Total</p>
            <p className="font-medium">{paidCount}/{repayments.length} installments</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total paid</p>
            <p className="font-medium text-green-600">K{totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-medium text-destructive">K{outstanding.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">{loan.phone || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Servicing actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loan.status === "pending" && (
            <Button size="sm" onClick={() => statusMutation.mutate("approved")}>Approve</Button>
          )}
          {["approved", "contract_signing", "awaiting_disbursement"].includes(loan.status) && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("disbursed")}>Mark disbursed</Button>
          )}
          {loan.status === "disbursed" && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("active")}>Activate</Button>
          )}
          {["pending", "under_review"].includes(loan.status) && (
            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("rejected")}>Reject</Button>
          )}
        </CardContent>
      </Card>

      {/* Repayment schedule */}
      <Card>
        <CardHeader><CardTitle className="text-base">Repayment schedule ({repayments.length} installments)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repayments.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.installment_number}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.due_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right font-medium">K{Number(r.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "paid" ? "default" : r.status === "cancelled" ? "secondary" : "destructive"} className="text-xs">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.paid_date ? format(new Date(r.paid_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    {r.status !== "paid" && r.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={payMutation.isPending}
                        onClick={() => payMutation.mutate({ repaymentId: r.id, amount: Number(r.amount) })}
                      >
                        Pay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {repayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No repayment schedule generated yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
