import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_deposited: number;
  total_withdrawn: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  created_at: string;
  notes: string | null;
}

export default function WalletWidget() {
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);

  // Calculate wallet-like data from loan repayments
  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ["user-wallet-summary", user?.id],
    queryFn: async () => {
      // Get all paid repayments as "deposits" to the loan
      const { data: repayments, error: repError } = await supabase
        .from("loan_repayments")
        .select("amount, status")
        .eq("user_id", user?.id);

      if (repError) throw repError;

      // Get disbursed loans as "received"
      const { data: loans, error: loanError } = await supabase
        .from("loan_applications")
        .select("loan_amount, total_repayment, status")
        .eq("user_id", user?.id)
        .in("status", ["active", "disbursed", "completed"]);

      if (loanError) throw loanError;

      const totalPaid = repayments?.filter(r => r.status === "paid").reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const totalPending = repayments?.filter(r => r.status === "pending").reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      const totalReceived = loans?.reduce((sum, l) => sum + Number(l.loan_amount), 0) || 0;
      const totalOwed = loans?.reduce((sum, l) => sum + Number(l.total_repayment || 0), 0) || 0;

      return {
        available_balance: totalOwed - totalPaid, // Outstanding balance
        pending_balance: totalPending,
        total_deposited: totalPaid, // Amount paid
        total_withdrawn: totalReceived, // Amount received
      };
    },
    enabled: !!user?.id,
  });

  // Get recent repayment transactions
  const { data: recentTransactions } = useQuery<Transaction[]>({
    queryKey: ["user-recent-repayments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("id, amount, status, paid_date, due_date, created_at")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      return data?.map(r => ({
        id: r.id,
        transaction_type: r.status === "paid" ? "payment" : "due",
        amount: Number(r.amount),
        created_at: r.paid_date || r.due_date || r.created_at,
        notes: r.status === "paid" ? "Loan repayment" : "Upcoming payment",
      })) || [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const wallet = walletData || { available_balance: 0, pending_balance: 0, total_deposited: 0, total_withdrawn: 0 };

  const getTransactionIcon = (type: string) => {
    return type === "payment" ? ArrowDownCircle : ArrowUpCircle;
  };

  const getTransactionColor = (type: string) => {
    return type === "payment" ? "text-success" : "text-warning";
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
                        {isPayment ? "Payment Made" : "Payment Due"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${colorClass}`}>
                      {isPayment ? "-" : ""}K{Number(txn.amount).toLocaleString()}
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
