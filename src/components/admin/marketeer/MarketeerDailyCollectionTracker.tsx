import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, AlertTriangle, Banknote, ChevronDown, ChevronUp, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isPast } from "date-fns";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { recordLoanPayment, type PaymentReceiptData } from "@/services/repositories/houseWorkflowRepository";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";

interface MarketeerLoan {
  id: string;
  full_name: string;
  phone: string;
  loan_amount: number;
  total_repayment: number;
  monthly_payment: number;
  loan_term_months: number;
  status: string;
  product_specific_data: any;
  created_at: string;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  status: string;
  principal_paid: number | null;
  installment_number: number;
}

export default function MarketeerDailyCollectionTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [expandedLoans, setExpandedLoans] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Fetch accounts for payment recording
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

  const { data: loans = [] } = useQuery({
    queryKey: ["marketeer-active-loans"],
    queryFn: async () => {
      const { data: product } = await supabase
        .from("loan_products")
        .select("id")
        .eq("product_code", "MARKETEER")
        .maybeSingle();
      if (!product) return [];
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, full_name, phone, loan_amount, total_repayment, monthly_payment, loan_term_months, status, product_specific_data, created_at")
        .eq("loan_product_id", product.id)
        .in("status", ["active", "disbursed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketeerLoan[];
    },
  });

  const loanIds = useMemo(() => loans.map((l) => l.id), [loans]);

  const { data: repayments = [] } = useQuery({
    queryKey: ["marketeer-repayments", loanIds],
    enabled: loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, loan_id, amount, due_date, status, principal_paid, installment_number")
        .in("loan_id", loanIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Repayment[];
    },
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const remainingOf = (r: Repayment) =>
    Math.max(Number(r.amount) - Number(r.principal_paid || 0), 0);

  const loanSummaries = useMemo(() => {
    return loans.map((loan) => {
      const loanRepayments = repayments.filter((r) => r.loan_id === loan.id);
      const paid = loanRepayments.filter((r) => r.status === "paid");
      // Include partial payments — sum principal_paid across ALL rows so partials
      // immediately reduce outstanding and show up in "Total collected".
      const totalPaid = loanRepayments.reduce(
        (s, r) => s + Number(r.principal_paid || (r.status === "paid" ? r.amount : 0)),
        0,
      );
      const outstanding = Number(loan.total_repayment) - totalPaid;
      const todayDue = loanRepayments.find(
        (r) => r.due_date === todayStr && r.status !== "paid" && r.status !== "cancelled"
      );
      const overdue = loanRepayments.filter(
        (r) => r.status !== "paid" && r.status !== "cancelled" && isPast(new Date(r.due_date)) && r.due_date !== todayStr
      );
      const dailyAmount = Number(loan.monthly_payment || loan.product_specific_data?.dailyRepayment || 0);
      const daysLeft = loanRepayments.filter((r) => r.status !== "paid" && r.status !== "cancelled").length;

      return {
        ...loan,
        totalPaid,
        outstanding: Math.max(outstanding, 0),
        todayDue,
        todayRemaining: todayDue ? remainingOf(todayDue) : 0,
        todayPaid: todayDue ? Number(todayDue.principal_paid || 0) : 0,
        overdueItems: overdue,
        overdueCount: overdue.length,
        // Bulk-pay total = sum of remaining (not full installment), so partials aren't double-charged.
        overdueAmount: overdue.reduce((s, r) => s + remainingOf(r), 0),
        dailyAmount,
        daysLeft,
        paidDays: paid.length,
        totalDays: loanRepayments.length,
      };
    });
  }, [loans, repayments, todayStr]);

  const handlePaymentSuccess = (receipt: PaymentReceiptData) => {
    queryClient.invalidateQueries({ queryKey: ["marketeer-repayments"] });
    queryClient.invalidateQueries({ queryKey: ["marketeer-active-loans"] });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["house-report-summary"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-active"] });

    toast({
      title: receipt.loan_completed ? "🎉 Loan fully paid!" : "✅ Payment recorded",
      description: `K${receipt.repayment_amount?.toLocaleString()} from ${receipt.borrower_name}. Receipt: ${receipt.receipt_no}`,
    });

    // Auto-download receipt
    if (receipt.receipt_no) {
      downloadRepaymentReceipt({
        borrowerName: receipt.borrower_name || "",
        borrowerPhone: receipt.borrower_phone || "",
        borrowerEmail: receipt.borrower_email || "",
        loanReference: receipt.loan_id?.slice(0, 8) || "",
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

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      return recordLoanPayment({
        repaymentId,
        amount,
        paymentMethod,
        accountId: selectedAccount || null,
      });
    },
    onSuccess: handlePaymentSuccess,
    onError: (e: Error) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
    },
  });

  const recordBulkOverdue = useMutation({
    mutationFn: async ({ items }: { items: { id: string; amount: number }[] }) => {
      let lastReceipt: PaymentReceiptData | null = null;
      for (const item of items) {
        lastReceipt = await recordLoanPayment({
          repaymentId: item.id,
          amount: item.amount,
          paymentMethod,
          accountId: selectedAccount || null,
        });
      }
      return lastReceipt;
    },
    onSuccess: (receipt) => {
      if (receipt) handlePaymentSuccess(receipt);
    },
    onError: (e: Error) => {
      toast({ title: "Bulk payment failed", description: e.message, variant: "destructive" });
    },
  });

  const toggleExpand = (loanId: string) => {
    setExpandedLoans((prev) => {
      const next = new Set(prev);
      if (next.has(loanId)) next.delete(loanId);
      else next.add(loanId);
      return next;
    });
  };

  const totalDueToday = loanSummaries.reduce((s, l) => s + l.todayRemaining, 0);
  const totalOverdue = loanSummaries.reduce((s, l) => s + l.overdueAmount, 0);
  const totalOutstanding = loanSummaries.reduce((s, l) => s + l.outstanding, 0);
  const totalCollected = loanSummaries.reduce((s, l) => s + l.totalPaid, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Daily Collection Tracker</h2>
        <BetaBadge />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Due today</p>
              <p className="text-lg font-bold">K{totalDueToday.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Total overdue</p>
              <p className="text-lg font-bold text-destructive">K{totalOverdue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total collected</p>
              <p className="text-lg font-bold text-green-600">K{totalCollected.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-bold">K{totalOutstanding.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment method and account selection */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Method:</span>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
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
            <SelectTrigger className={`w-44 h-8 text-xs ${!selectedAccount ? "border-destructive" : ""}`}>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedAccount && (
            <span className="text-xs text-destructive">Required</span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's collections — {format(new Date(), "EEEE, dd MMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Daily amt</TableHead>
                <TableHead className="text-right">Paid / Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Today</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {loanSummaries.map((loan) => (
                <React.Fragment key={loan.id}>
                  <TableRow>
                    <TableCell className="w-8">
                      {loan.overdueCount > 0 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(loan.id)}>
                          {expandedLoans.has(loan.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{loan.full_name}</TableCell>
                    <TableCell className="text-sm">{loan.phone}</TableCell>
                    <TableCell className="text-right">K{Number(loan.loan_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">K{loan.dailyAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600">{loan.paidDays}</span>
                      <span className="text-muted-foreground">/{loan.totalDays}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">K{loan.outstanding.toLocaleString()}</TableCell>
                    <TableCell>
                      {loan.overdueCount > 0 ? (
                        <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => toggleExpand(loan.id)}>
                          {loan.overdueCount} day{loan.overdueCount > 1 ? "s" : ""} (K{loan.overdueAmount.toLocaleString()})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">On track</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {loan.todayDue ? (
                        <Badge variant="secondary" className="text-xs">
                          K{loan.todayRemaining.toLocaleString()} due
                          {loan.todayPaid > 0 && (
                            <span className="ml-1 text-muted-foreground">(K{loan.todayPaid.toLocaleString()} paid)</span>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {loan.todayDue ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            placeholder={String(loan.todayRemaining)}
                            className="w-20 h-7 text-xs"
                            value={payAmounts[loan.todayDue.id] ?? ""}
                            onChange={(e) =>
                              setPayAmounts((p) => ({ ...p, [loan.todayDue!.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            disabled={recordPaymentMutation.isPending || !selectedAccount}
                            onClick={() =>
                              recordPaymentMutation.mutate({
                                repaymentId: loan.todayDue!.id,
                                amount: Number(payAmounts[loan.todayDue!.id] || loan.todayRemaining),
                              })
                            }
                          >
                            Pay
                          </Button>
                        </div>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expandable overdue rows */}
                  {expandedLoans.has(loan.id) && loan.overdueItems.length > 0 && (
                    <TableRow key={`${loan.id}-overdue-header`} className="bg-destructive/5">
                      <TableCell colSpan={10} className="p-0">
                        <div className="px-4 py-2 space-y-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-destructive">Overdue installments for {loan.full_name}</p>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              disabled={recordBulkOverdue.isPending || !selectedAccount}
                              onClick={() =>
                                recordBulkOverdue.mutate({
                                  items: loan.overdueItems.map((r) => ({ id: r.id, amount: remainingOf(r) })),
                                })
                              }
                            >
                              Pay all {loan.overdueCount} overdue (K{loan.overdueAmount.toLocaleString()})
                            </Button>
                          </div>
                          {loan.overdueItems.map((r) => {
                            const remaining = remainingOf(r);
                            const partialPaid = Number(r.principal_paid || 0);
                            return (
                              <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                                <span className="text-muted-foreground">
                                  Day {r.installment_number} — {format(new Date(r.due_date), "dd MMM yyyy")}
                                  {partialPaid > 0 && (
                                    <span className="ml-1 text-amber-600">(K{partialPaid.toLocaleString()} paid, K{remaining.toLocaleString()} left)</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">K{remaining.toLocaleString()}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs px-2"
                                    disabled={recordPaymentMutation.isPending || !selectedAccount}
                                    onClick={() => recordPaymentMutation.mutate({ repaymentId: r.id, amount: remaining })}
                                  >
                                    Pay
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {loanSummaries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No active marketeer loans found.
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
