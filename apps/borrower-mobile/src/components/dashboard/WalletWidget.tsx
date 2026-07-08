import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, Loader2, Building, Smartphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  expected_disbursed_total: number;
  reconciliation_gap: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  created_at: string;
  notes: string | null;
  reference?: string | null;
  method?: string | null;
}

export default function WalletWidget() {
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);

  // Calculate wallet totals from disbursements + repayments
  const { data: walletData, isLoading, isError } = useQuery<WalletData>({
    queryKey: ["user-wallet-summary", user?.id],
    queryFn: async () => {
      const { data: repayments, error: repError } = await supabase
        .from("loan_repayments")
        .select("amount, status, principal_paid, original_amount, penalty_amount, penalty_paid")
        .eq("user_id", user?.id);

      if (repError) throw repError;

      const { data: disbursements, error: disbursementError } = await supabase
        .from("disbursements")
        .select("amount, status, loan_applications!inner(user_id)")
        .eq("loan_applications.user_id", user?.id)
        .eq("status", "completed");
      if (disbursementError) throw disbursementError;

      const { data: loans, error: loanError } = await supabase
        .from("loan_applications")
        .select("loan_amount, total_repayment, status")
        .eq("user_id", user?.id)
        .in("status", ["active", "disbursed", "completed"]);

      if (loanError) throw loanError;

      const totalPaid = repayments?.reduce((sum, r) => {
        const principal = Number(r.principal_paid || (r.status === "paid" ? r.original_amount || r.amount : 0));
        const penalty = Number(r.penalty_paid || 0);
        return sum + principal + penalty;
      }, 0) || 0;
      const totalPending = repayments
        ?.filter((r) => ["pending", "overdue", "partial"].includes(r.status || ""))
        .reduce((sum, r) => {
          const base = Number(r.original_amount ?? r.amount ?? 0);
          const paid = Number(r.principal_paid ?? 0);
          const penaltyDue = Math.max(0, Number(r.penalty_amount ?? 0) - Number(r.penalty_paid ?? 0));
          return sum + Math.max(0, base - paid) + penaltyDue;
        }, 0) || 0;
      const totalReceived = disbursements?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      const totalOwed = loans?.reduce((sum, l) => sum + Number(l.total_repayment || 0), 0) || 0;
      const expectedDisbursed = loans
        ?.filter((l) => ["disbursed", "active", "completed"].includes(l.status))
        .reduce((sum, l) => sum + Number(l.loan_amount || 0), 0) || 0;
      const reconciliationGap = Math.round((expectedDisbursed - totalReceived) * 100) / 100;

      return {
        available_balance: totalOwed - totalPaid, // Outstanding balance
        pending_balance: totalPending,
        total_deposited: totalPaid, // Amount paid
        total_withdrawn: totalReceived, // Amount received
        expected_disbursed_total: expectedDisbursed,
        reconciliation_gap: reconciliationGap,
      };
    },
    enabled: !!user?.id,
  });

  // Get recent disbursement + repayment transactions
  const { data: recentTransactions } = useQuery<Transaction[]>({
    queryKey: ["user-recent-wallet-activity", user?.id],
    queryFn: async () => {
      const { data: repayments, error: repaymentsError } = await supabase
        .from("loan_repayments")
        .select("id, amount, status, paid_date, due_date, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (repaymentsError) throw repaymentsError;

      const { data: disbursements, error: disbursementsError } = await supabase
        .from("disbursements")
        .select("id, amount, disbursement_method, transaction_reference, disbursed_at, created_at, status, loan_applications!inner(user_id)")
        .eq("loan_applications.user_id", user?.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);
      if (disbursementsError) throw disbursementsError;

      const repaymentEvents =
        repayments?.map((r) => ({
          id: `rep-${r.id}`,
          transaction_type: r.status === "paid" ? "payment" : "due",
          amount: Number(r.amount),
          created_at: r.paid_date || r.due_date || r.created_at,
          notes: r.status === "paid" ? "Loan repayment received" : "Upcoming repayment due",
          reference: null,
          method: null,
        })) || [];

      const disbursementEvents =
        disbursements?.map((d) => ({
          id: `disb-${d.id}`,
          transaction_type: "disbursement",
          amount: Number(d.amount),
          created_at: d.disbursed_at || d.created_at,
          notes: "Loan disbursed to declared payout destination",
          reference: d.transaction_reference,
          method: d.disbursement_method,
        })) || [];

      return [...repaymentEvents, ...disbursementEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
    },
    enabled: !!user?.id,
  });

  if (isError) {
    return (
      <Card className="glass border-destructive/30">
        <CardContent className="p-6 text-center text-sm text-destructive">
          Could not load loan summary. Please try again later.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const wallet = walletData || {
    available_balance: 0,
    pending_balance: 0,
    total_deposited: 0,
    total_withdrawn: 0,
    expected_disbursed_total: 0,
    reconciliation_gap: 0,
  };

  const getTransactionIcon = (type: string) => {
    if (type === "payment") return ArrowDownCircle;
    if (type === "disbursement") return ArrowUpCircle;
    return ArrowUpCircle;
  };

  const getTransactionColor = (type: string) => {
    if (type === "payment") return "text-success";
    if (type === "disbursement") return "text-primary";
    return "text-warning";
  };

  return (
    <Card className="glass border-border/50 overflow-hidden">
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Loan Summary</h3>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalance(!showBalance)}
            className="h-8 w-8"
          >
            {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
        </div>

        <div className="mb-2">
          {showBalance ? (
            <p className="text-4xl font-bold text-primary">
              K{Number(wallet.available_balance).toLocaleString()}
            </p>
          ) : (
            <p className="text-4xl font-bold text-muted-foreground">••••••</p>
          )}
        </div>

        {wallet.pending_balance > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-xs">
              K{Number(wallet.pending_balance).toLocaleString()} Pending
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-sm font-semibold text-success">
              {showBalance ? `K${Number(wallet.total_deposited).toLocaleString()}` : "••••"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Total Received</p>
            <p className="text-sm font-semibold text-foreground">
              {showBalance ? `K${Number(wallet.total_withdrawn).toLocaleString()}` : "••••"}
            </p>
          </div>
        </div>
        <div className="mt-3">
          {Math.abs(wallet.reconciliation_gap) < 0.01 ? (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs">
              Reconciled with disbursement records
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-xs">
              Reconciliation gap K{Math.abs(wallet.reconciliation_gap).toLocaleString()} - support is reviewing
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Recent Activity</h4>
          <Badge variant="outline" className="text-xs">
            {recentTransactions?.length || 0} transactions
          </Badge>
        </div>

        {recentTransactions && recentTransactions.length > 0 ? (
          <div className="space-y-2">
            {recentTransactions.map((txn) => {
              const Icon = getTransactionIcon(txn.transaction_type);
              const colorClass = getTransactionColor(txn.transaction_type);
              const isPayment = txn.transaction_type === "payment";
              const isDisbursement = txn.transaction_type === "disbursement";

              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${isPayment ? "bg-success/20" : "bg-warning/20"} flex items-center justify-center`}>
                      <Icon size={14} className={colorClass} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {isPayment ? "Repayment Made" : isDisbursement ? "Loan Disbursed" : "Repayment Due"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.created_at), "MMM dd, yyyy")}
                      </p>
                      {isDisbursement && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {txn.method === "bank_transfer" ? <Building size={11} /> : <Smartphone size={11} />}
                          {txn.reference ? `Ref ${txn.reference}` : "Payout destination credited"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${colorClass}`}>
                      {isPayment ? "-" : isDisbursement ? "+" : ""}K{Number(txn.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Wallet className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No activity yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
