import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHouseLoans, useHouseProduct } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { downloadLoanSchedule } from "@/utils/generateLoanSchedule";
import { recordLoanPayment } from "@/services/repositories/houseWorkflowRepository";
import { downloadReceiptFromRpc } from "@/utils/handlePaymentReceipt";
import { differenceInCalendarDays, format } from "date-fns";
import { AlertCircle, ArrowLeft, Banknote, Calendar, CheckCircle2, Download, FileText } from "lucide-react";
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
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [fullDetailsOpen, setFullDetailsOpen] = useState(false);
  const creditToRef = useRef<HTMLButtonElement | null>(null);

  const focusCreditTo = () => {
    creditToRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    creditToRef.current?.focus();
  };

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
    queryClient.invalidateQueries({ queryKey: ["house-loan-disbursement", loanId] });
    queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-disbursements", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
    queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
  };

  const payMutation = useMutation({
    mutationFn: async ({ repaymentId, amount, expected }: { repaymentId: string; amount: number; expected: number }) => {
      if (!selectedAccount) throw new Error("Select the account to credit first");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid payment amount");
      if (amount > expected * 1.5) {
        throw new Error(`Amount K${amount.toLocaleString()} exceeds installment K${expected.toLocaleString()} by more than 50%`);
      }
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

  // Sum principal_paid across ALL installments (paid, partial, pending) so partial
  // payments show on the summary card immediately — not only fully-paid rows.
  const totalPaid = repayments.reduce(
    (s: number, r: any) => s + Number(r.principal_paid || (r.status === "paid" ? r.amount : 0) || 0),
    0,
  );
  const outstanding = Math.max(Number(loan.total_repayment || loan.loan_amount || 0) - totalPaid, 0);
  const paidCount = repayments.filter((r: any) => r.status === "paid").length;
  const partialCount = repayments.filter((r: any) => r.status === "partial").length;
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
              <span className="text-success">{paidCount}</span>/{repayments.length} installments
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="font-medium text-success">K{totalPaid.toLocaleString()}</p>
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

      {/* Servicing actions live in the full loan details modal — keeps a single source of truth */}

      {/* Hint when Credit-to is missing */}
      {pendingRepayments.length > 0 && !selectedAccount && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span>Select a <strong>“Credit to”</strong> account below to enable the Pay buttons.</span>
            <Button size="sm" variant="outline" onClick={focusCreditTo}>
              Choose account
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
              <SelectTrigger ref={creditToRef} className="w-44 h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar size={16} /> Repayment Schedule ({repayments.length} installments)
            </CardTitle>
            <div className="flex items-center gap-2">
              {overdueRows.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueRows.length} overdue · K{overdueAmount.toLocaleString()} · oldest {oldestOverdueDays}d late
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadSchedule} disabled={repayments.length === 0}>
                <Download size={14} className="mr-1" /> PDF
              </Button>
            </div>
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
              {repayments.map((r: any) => {
                const isPending = r.status !== "paid" && r.status !== "cancelled";
                const isOverdue = isPending && r.due_date && r.due_date < todayStr;
                const daysLate = isOverdue ? differenceInCalendarDays(today, new Date(r.due_date)) : 0;
                return (
                  <TableRow key={r.id} className={isOverdue ? "bg-destructive/5" : undefined}>
                    <TableCell className="text-sm">{r.installment_number}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.due_date), "dd MMM yyyy (EEE)")}
                      {isOverdue && (
                        <span className="block text-xs text-destructive">{daysLate}d late</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">K{Number(r.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "paid" ? "default" : r.status === "cancelled" ? "secondary" : isOverdue ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {isOverdue ? "overdue" : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.paid_date ? format(new Date(r.paid_date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {r.payment_method?.replace(/_/g, " ") || "—"}
                    </TableCell>
                    <TableCell>
                      {isPending && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder={String(r.amount)}
                            className="w-20 h-7 text-xs"
                            value={payAmounts[r.id] ?? ""}
                            onChange={(e) => setPayAmounts((p) => ({ ...p, [r.id]: e.target.value }))}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    variant={isOverdue ? "destructive" : "outline"}
                                    className="h-7 text-xs"
                                    disabled={payMutation.isPending || !selectedAccount}
                                    onClick={() => payMutation.mutate({
                                      repaymentId: r.id,
                                      amount: Number(payAmounts[r.id] || r.amount),
                                      expected: Number(r.amount || 0),
                                    })}
                                  >
                                    Pay
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!selectedAccount && (
                                <TooltipContent>Choose a “Credit to” account first.</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                      {r.status === "paid" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
