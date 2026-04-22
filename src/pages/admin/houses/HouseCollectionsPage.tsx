import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHouseRepayments, useHouseLoans } from "@/hooks/useHouseData";
import { useToast } from "@/hooks/use-toast";
import { recordLoanPayment, type PaymentReceiptData } from "@/services/repositories/houseWorkflowRepository";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Banknote, Clock } from "lucide-react";

export default function HouseCollectionsPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: repayments } = useHouseRepayments(productCode);
  const { data: loans } = useHouseLoans(productCode);
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

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Build a map of loan_id -> loan for borrower info
  const loanMap = useMemo(() => {
    const map: Record<string, any> = {};
    (loans ?? []).forEach((l: any) => { map[l.id] = l; });
    return map;
  }, [loans]);

  const todayDue = useMemo(() =>
    (repayments ?? []).filter((r: any) => r.due_date === todayStr && r.status !== "paid" && r.status !== "cancelled"),
    [repayments, todayStr]
  );

  const overdue = useMemo(() =>
    (repayments ?? []).filter((r: any) => r.status !== "paid" && r.status !== "cancelled" && r.due_date && r.due_date < todayStr),
    [repayments, todayStr]
  );

  const paidToday = useMemo(() =>
    (repayments ?? []).filter((r: any) => r.status === "paid" && r.paid_date === todayStr),
    [repayments, todayStr]
  );

  const totalDue = todayDue.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalOverdue = overdue.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const totalCollectedToday = paidToday.reduce((s: number, r: any) => s + Number(r.principal_paid || r.amount || 0), 0);
  const totalOutstanding = (repayments ?? [])
    .filter((r: any) => r.status !== "paid" && r.status !== "cancelled")
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const handlePaymentSuccess = (receipt: PaymentReceiptData) => {
    queryClient.invalidateQueries({ queryKey: ["house-repayments", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
    queryClient.invalidateQueries({ queryKey: ["house-report-summary", productCode] });
    queryClient.invalidateQueries({ queryKey: ["accounts-active"] });

    toast({
      title: receipt.loan_completed ? "🎉 Loan fully paid!" : "✅ Payment recorded",
      description: `K${receipt.repayment_amount?.toLocaleString()} from ${receipt.borrower_name}. Receipt: ${receipt.receipt_no}`,
    });

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

  const payMutation = useMutation({
    mutationFn: async ({ repaymentId, amount }: { repaymentId: string; amount: number }) => {
      if (!selectedAccount) throw new Error("Select the account to credit before recording payments");
      return recordLoanPayment({
        repaymentId,
        amount,
        paymentMethod,
        accountId: selectedAccount,
      });
    },
    onSuccess: handlePaymentSuccess,
    onError: (e: Error) => {
      toast({ title: "Payment failed", description: e.message, variant: "destructive" });
    },
  });

  const allItems = [...todayDue, ...overdue].sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">Collections</h2>
        <BetaBadge />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Due today</p>
              <p className="text-lg font-bold">K{totalDue.toLocaleString()}</p>
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
              <p className="text-xs text-muted-foreground">Collected today</p>
              <p className="text-lg font-bold text-green-600">K{totalCollectedToday.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total outstanding</p>
              <p className="text-lg font-bold">K{totalOutstanding.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment settings */}
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
            <SelectTrigger className={`w-44 h-8 text-xs ${!selectedAccount ? "border-destructive" : ""}`}><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedAccount && <span className="text-xs text-destructive">Required</span>}
        </div>
      </div>

      {/* Repayment table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Due & overdue — {format(new Date(), "EEEE, dd MMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>#</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allItems.map((r: any) => {
                const loan = loanMap[r.loan_id];
                const isOverdue = r.due_date !== todayStr;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{loan?.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.due_date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right font-medium">K{Number(r.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      {isOverdue ? (
                        <Badge variant="destructive" className="text-xs">Overdue</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Due today</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">#{r.installment_number}</TableCell>
                    <TableCell>
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
                          variant="default"
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
                    </TableCell>
                  </TableRow>
                );
              })}
              {allItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No due or overdue repayments.
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
