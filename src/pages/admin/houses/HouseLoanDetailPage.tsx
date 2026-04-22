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
import { useHouseLoans, useHouseProduct } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { createRepaymentScheduleForLoan } from "@/utils/createRepaymentSchedule";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { calculateLoan } from "@/utils/loanCalculations";
import { houseMarkDisbursementCompleted, houseSetLoanStatus, recordLoanPayment } from "@/services/repositories/houseWorkflowRepository";
import { downloadReceiptFromRpc } from "@/utils/handlePaymentReceipt";
import { differenceInCalendarDays } from "date-fns";
import { format } from "date-fns";
import { ArrowLeft, Banknote, Calendar, CheckCircle2, Download, FileText } from "lucide-react";
import HouseLoanActions from "@/components/admin/houses/HouseLoanActions";
import LoanDetailsModal from "@/components/admin/LoanDetailsModal";

export default function HouseLoanDetailPage() {
  const { productCode = "", loanId = "" } = useParams<{ productCode: string; loanId: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const { data: product } = useHouseProduct(productCode);
  const loan = useMemo(() => (loans ?? []).find((l: any) => l.id === loanId), [loans, loanId]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedDisbursementAccount, setSelectedDisbursementAccount] = useState("");
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [fullDetailsOpen, setFullDetailsOpen] = useState(false);

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

  const { data: pendingDisbursement } = useQuery({
    queryKey: ["house-loan-disbursement", loanId],
    enabled: Boolean(loanId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("id, status, source_account_id")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).find((item: any) => !["completed", "failed", "cancelled"].includes(item.status)) ?? null;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["house-loan-repayments", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-loan-disbursement", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-disbursements", productCode] });
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

  const payMutation = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      if (!selectedAccount) throw new Error("Select the account to credit first");
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
      downloadReceiptFromRpc(receipt, { loanReferenceFallback: loanId.slice(0, 8) });
    },
    onError: (e: Error) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
    },
  });

  const disbursementMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("Loan not found");
      const accountId = pendingDisbursement?.source_account_id || selectedDisbursementAccount;
      if (!accountId) throw new Error("Select the funding account to debit");

      let disbursementId = pendingDisbursement?.id || null;
      if (!disbursementId) {
        const calc = calculateLoan(
          Number(loan.loan_amount || 0),
          Number(loan.loan_term_months || 0),
          {
            product_name: product?.name || null,
            product_code: product?.product_code || productCode,
            pricing_tiers: product?.pricing_tiers,
            interest_rate: Number(product?.interest_rate || 0),
            interest_period: (product?.interest_period as any) || null,
            interest_type: (product?.interest_type as any) || null,
            processing_fee_percent: product?.processing_fee_percent || 0,
            enforcement_fee_percent: product?.enforcement_fee_percent || 0,
            insurance_percent: product?.insurance_percent || 0,
            vat_percent: product?.vat_percent || 0,
            platform_fee_percent: product?.platform_fee_percent || 0,
            term_unit: (product?.term_unit as any) || null,
          },
          ((loan.term_unit || product?.term_unit || "months") as any),
        );

        const { data: inserted, error: insertError } = await supabase
          .from("disbursements")
          .insert({
            loan_id: loan.id,
            amount: Number(calc.disbursementAmount || loan.loan_amount || 0),
            disbursement_method: "cash",
            status: "pending",
            source_account_id: accountId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        disbursementId = inserted.id;
      }

      await houseMarkDisbursementCompleted({ disbursementId, accountId });
      await createRepaymentScheduleForLoan(
        {
          id: loan.id,
          user_id: loan.user_id,
          loan_term_months: Number(loan.loan_term_months || 0),
          total_repayment: Number(loan.total_repayment || 0),
          monthly_payment: Number((loan as any).monthly_payment || 0),
          loan_product_id: (loan as any).loan_product_id || null,
          term_unit: loan.term_unit || product?.term_unit || "months",
        },
        supabase,
      );
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Disbursement completed and account debited" });
    },
    onError: (e: Error) => {
      toast({ title: "Disbursement failed", description: e.message, variant: "destructive" });
    },
  });

  const handleDownloadSchedule = async () => {
    if (!loan || repayments.length === 0) {
      toast({ title: "No repayment schedule yet", description: "Disburse the loan first.", variant: "destructive" });
      return;
    }

    const { data: settings } = await (supabase.from("system_settings") as any)
      .select("setting_key, setting_value")
      .in("setting_key", ["company_name", "company_address", "company_phone"]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: any) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    downloadLoanSchedule({
      borrowerName: loan.full_name || borrowerProfile?.full_name || "",
      borrowerPhone: loan.phone || borrowerProfile?.phone || "",
      borrowerEmail: loan.email || borrowerProfile?.email || "",
      loanReference: loan.id.slice(0, 8).toUpperCase(),
      loanAmount: Number(loan.loan_amount || 0),
      interestRate: Number(product?.interest_rate || 0),
      interestPeriod: product?.interest_period || (loan.term_unit === "days" ? "daily" : loan.term_unit === "weeks" ? "weekly" : "monthly"),
      termMonths: Number(loan.loan_term_months || 0),
      monthlyPayment: Number((loan as any).monthly_payment || repayments[0]?.amount || 0),
      totalRepayment: Number(loan.total_repayment || 0),
      disbursementDate: (loan as any).disbursed_at || loan.created_at,
      firstRepaymentDate: repayments[0]?.due_date || "",
      termSummaryLabel: `${loan.loan_term_months} ${loan.term_unit || product?.term_unit || "months"}`,
      paymentColumnTitle: loan.term_unit === "days" ? "DAILY PAYMENT" : loan.term_unit === "weeks" ? "WEEKLY PAYMENT" : "MONTHLY PAYMENT",
      repayments: repayments.map((r: any) => ({
        installmentNumber: r.installment_number,
        dueDate: r.due_date,
        amount: Number(r.amount || 0),
        status: r.status,
        paidDate: r.paid_date || undefined,
      })),
      companyName: settingsMap.company_name,
      companyAddress: settingsMap.company_address,
      companyPhone: settingsMap.company_phone,
    });

    toast({ title: "Repayment schedule PDF downloaded" });
  };

  if (!loan) return <p className="text-sm text-muted-foreground p-4">Loan not found.</p>;

  const totalPaid = repayments.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0);
  const outstanding = Math.max(Number(loan.total_repayment || loan.loan_amount || 0) - totalPaid, 0);
  const paidCount = repayments.filter((r: any) => r.status === "paid").length;
  const pendingRepayments = repayments.filter((r: any) => r.status !== "paid" && r.status !== "cancelled");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const overdueRows = pendingRepayments.filter((r: any) => r.due_date && r.due_date < todayStr);
  const overdueAmount = overdueRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const oldestOverdueDays = overdueRows.length > 0
    ? Math.max(...overdueRows.map((r: any) => differenceInCalendarDays(today, new Date(r.due_date))))
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/admin/houses/${productCode}/loans`}>
            <ArrowLeft size={14} className="mr-1" /> Back to loans
          </Link>
        </Button>
        <Button size="sm" onClick={() => setFullDetailsOpen(true)}>
          <FileText size={14} className="mr-1" /> Open full loan details
        </Button>
      </div>

      <LoanDetailsModal
        loan={loan as any}
        open={fullDetailsOpen}
        onOpenChange={(o) => {
          setFullDetailsOpen(o);
          if (!o) invalidateAll();
        }}
      />

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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedDisbursementAccount} onValueChange={setSelectedDisbursementAccount}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Funding account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => disbursementMutation.mutate()} disabled={disbursementMutation.isPending || (!pendingDisbursement?.source_account_id && !selectedDisbursementAccount)}>
                {pendingDisbursement ? "Complete disbursement" : "Disburse from account"}
              </Button>
            </div>
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

      {/* Advanced loan actions toolbar (parity with legacy LoanDetailsModal) */}
      <HouseLoanActions loan={loan} product={product} productCode={productCode} onChanged={invalidateAll} />

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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar size={16} /> Repayment Schedule ({repayments.length} installments)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={handleDownloadSchedule} disabled={repayments.length === 0}>
              <Download size={14} className="mr-1" /> PDF
            </Button>
          </div>
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
                          disabled={payMutation.isPending || !selectedAccount}
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
