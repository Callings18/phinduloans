import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { houseSetLoanStatus, recordLoanPayment, type PaymentReceiptData } from "@/services/repositories/houseWorkflowRepository";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { format } from "date-fns";
import { ArrowLeft, User, Banknote, Calendar, CheckCircle2 } from "lucide-react";

export default function HouseLoanDetailPage() {
  const { productCode = "", loanId = "" } = useParams<{ productCode: string; loanId: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const loan = useMemo(() => (loans ?? []).find((l: any) => l.id === loanId), [loans, loanId]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: repayments = [] } = useQuery({
    queryKey: ["house-loan-repayments", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, amount, due_date, status, installment_number, principal_paid, paid_date, payment_method, transaction_reference")
        .eq("loan_id", loanId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: borrowerProfile } = useQuery({
    queryKey: ["house-loan-borrower", loan?.user_id],
    enabled: Boolean(loan?.user_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, city, nrc_number, address, employer_name, employment_type")
        .eq("id", loan!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["house-loan-repayments", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
    queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => houseSetLoanStatus(loanId, status),
    onSuccess: async () => {
      invalidateAll();
      toast({ title: "Loan updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleReceiptDownload = (receipt: PaymentReceiptData) => {
    if (receipt.receipt_no) {
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
  };

  const payMutation = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      return recordLoanPayment({
        repaymentId,
        amount,
        paymentMethod,
        accountId: selectedAccount || null,
      });
    },
    onSuccess: (receipt) => {
      invalidateAll();
      toast({
        title: receipt?.loan_completed ? "🎉 Loan fully paid!" : "✅ Payment recorded",
        description: `Receipt: ${receipt?.receipt_no}`,
      });
      if (receipt) handleReceiptDownload(receipt);
    },
    onError: (e: Error) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
    },
  });

  if (!loan) return <p className="text-sm text-muted-foreground p-4">Loan not found.</p>;

  const totalPaid = repayments.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0);
  const outstanding = Math.max(Number(loan.total_repayment || loan.loan_amount || 0) - totalPaid, 0);
  const paidCount = repayments.filter((r: any) => r.status === "paid").length;
  const pendingRepayments = repayments.filter((r: any) => r.status !== "paid" && r.status !== "cancelled");

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to={`/admin/houses/${productCode}/loans`}>
          <ArrowLeft size={14} className="mr-1" /> Back to loans
        </Link>
      </Button>

      {/* Loan summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote size={18} /> Loan Detail
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Borrower</p>
            <p className="font-medium">{loan.full_name || loan.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">{loan.phone || borrowerProfile?.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="font-medium">K{Number(loan.loan_amount || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Repayment</p>
            <p className="font-medium">K{Number(loan.total_repayment || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={loan.status === "active" ? "default" : loan.status === "completed" ? "secondary" : "outline"}>
              {loan.status?.replace(/_/g, " ")}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="font-medium">
              <span className="text-green-600">{paidCount}</span>/{repayments.length} installments
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="font-medium text-green-600">K{totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-medium text-destructive">K{outstanding.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Term</p>
            <p className="font-medium">{loan.loan_term_months} {loan.term_unit || "months"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NRC</p>
            <p className="font-medium">{loan.nrc_number || borrowerProfile?.nrc_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium text-sm">{loan.created_at ? format(new Date(loan.created_at), "dd MMM yyyy") : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">City</p>
            <p className="font-medium">{loan.city || borrowerProfile?.city || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Servicing actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Servicing Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loan.status === "pending" && (
            <>
              <Button size="sm" onClick={() => statusMutation.mutate("approved")} disabled={statusMutation.isPending}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("rejected")} disabled={statusMutation.isPending}>Reject</Button>
            </>
          )}
          {["approved", "contract_signing", "awaiting_disbursement"].includes(loan.status) && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("disbursed")} disabled={statusMutation.isPending}>Mark Disbursed</Button>
          )}
          {loan.status === "disbursed" && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("active")} disabled={statusMutation.isPending}>Activate</Button>
          )}
          {["active", "disbursed"].includes(loan.status) && (
            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("defaulted")} disabled={statusMutation.isPending}>Default</Button>
          )}
          {!["pending", "rejected", "completed", "defaulted"].includes(loan.status) && (
            <span className="text-xs text-muted-foreground self-center ml-2">
              Current: <strong>{loan.status?.replace(/_/g, " ")}</strong>
            </span>
          )}
        </CardContent>
      </Card>

      {/* Payment settings */}
      {pendingRepayments.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Method:</span>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Credit to:</span>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Repayment schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={16} /> Repayment Schedule ({repayments.length} installments)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repayments.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.installment_number}</TableCell>
                  <TableCell className="text-sm">{format(new Date(r.due_date), "dd MMM yyyy (EEE)")}</TableCell>
                  <TableCell className="text-right font-medium">K{Number(r.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "paid" ? "default" : r.status === "cancelled" ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.paid_date ? format(new Date(r.paid_date), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">
                    {r.payment_method?.replace(/_/g, " ") || "—"}
                  </TableCell>
                  <TableCell>
                    {r.status !== "paid" && r.status !== "cancelled" && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder={String(r.amount)}
                          className="w-20 h-7 text-xs"
                          value={payAmounts[r.id] ?? ""}
                          onChange={(e) => setPayAmounts((p) => ({ ...p, [r.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={payMutation.isPending}
                          onClick={() => payMutation.mutate({
                            repaymentId: r.id,
                            amount: Number(payAmounts[r.id] || r.amount),
                          })}
                        >
                          Pay
                        </Button>
                      </div>
                    )}
                    {r.status === "paid" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {repayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No repayment schedule generated yet. Disburse the loan to generate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
