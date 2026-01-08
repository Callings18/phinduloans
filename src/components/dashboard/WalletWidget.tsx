import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { format } from "date-fns";

interface WalletData {
  id: string;
  available_balance: number;
  pending_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  is_active: boolean;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  status: string;
}

export default function WalletWidget() {
  const { user } = useAuth();
  const [showBalance, setShowBalance] = useState(true);

  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: ["user-wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_accounts")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      
      // If no wallet exists, create one
      if (!data) {
        const { data: newWallet, error: createError } = await supabase
          .from("wallet_accounts")
          .insert({ user_id: user?.id, available_balance: 0 })
          .select()
          .single();
        
        if (createError) throw createError;
        return newWallet;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: recentTransactions } = useQuery<Transaction[]>({
    queryKey: ["user-wallet-transactions", wallet?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet?.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!wallet?.id,
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

  if (!wallet) {
    return null;
  }

  const getTransactionIcon = (type: string) => {
    return ["credit", "refund"].includes(type) ? ArrowDownCircle : ArrowUpCircle;
  };

  const getTransactionColor = (type: string) => {
    return ["credit", "refund"].includes(type) ? "text-success" : "text-destructive";
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
              <h3 className="font-semibold text-foreground">My Wallet</h3>
              <p className="text-xs text-muted-foreground">Available Balance</p>
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
            <p className="text-xs text-muted-foreground mb-1">Total Deposited</p>
            <p className="text-sm font-semibold text-success">
              {showBalance ? `K${Number(wallet.total_deposited).toLocaleString()}` : "••••"}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Total Withdrawn</p>
            <p className="text-sm font-semibold text-foreground">
              {showBalance ? `K${Number(wallet.total_withdrawn).toLocaleString()}` : "••••"}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="pt-4">
        {!wallet.is_active && (
          <div className="mb-4 p-3 rounded-lg bg-warning/20 border border-warning/30 text-sm text-warning">
            Your wallet is currently inactive. Contact support for assistance.
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Recent Transactions</h4>
          <Badge variant="outline" className="text-xs">
            {recentTransactions?.length || 0} transactions
          </Badge>
        </div>

        {recentTransactions && recentTransactions.length > 0 ? (
          <div className="space-y-2">
            {recentTransactions.map((txn) => {
              const Icon = getTransactionIcon(txn.transaction_type);
              const colorClass = getTransactionColor(txn.transaction_type);
              const isCredit = ["credit", "refund"].includes(txn.transaction_type);

              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${isCredit ? "bg-success/20" : "bg-destructive/20"} flex items-center justify-center`}>
                      <Icon size={14} className={colorClass} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {txn.transaction_type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${colorClass}`}>
                      {isCredit ? "+" : "-"}K{Number(txn.amount).toLocaleString()}
                    </p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {txn.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Wallet className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No transactions yet</p>
          </div>
        )}

        {wallet.available_balance > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center mb-2">
              You can use your wallet balance for loan repayments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
