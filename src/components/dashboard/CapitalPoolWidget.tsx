import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Building, Smartphone, Banknote, TrendingUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
}

export default function CapitalPoolWidget() {
  const [showBalances, setShowBalances] = useState(true);

  // Fetch all active accounts
  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, balance, is_active")
        .eq("is_active", true)
        .order("account_name");

      if (error) throw error;
      return data;
    },
  });

  // Calculate totals by account type
  const totals = {
    total: accounts.reduce((sum, acc) => sum + acc.balance, 0),
    bank: accounts.filter(a => a.account_type === 'bank').reduce((sum, a) => sum + a.balance, 0),
    mobile_money: accounts.filter(a => a.account_type === 'mobile_money').reduce((sum, a) => sum + a.balance, 0),
    cash: accounts.filter(a => a.account_type === 'cash').reduce((sum, a) => sum + a.balance, 0),
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return Building;
      case 'mobile_money':
        return Smartphone;
      case 'cash':
        return Banknote;
      default:
        return Wallet;
    }
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50 overflow-hidden">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="text-primary" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">Total Capital Pool</h3>
              <p className="text-xs text-muted-foreground">Available across all accounts</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalances(!showBalances)}
            className="h-9 w-9"
          >
            {showBalances ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
        </div>

        {/* Total Balance */}
        <div className="mb-4">
          {showBalances ? (
            <p className="text-5xl font-bold text-primary">
              K{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ) : (
            <p className="text-5xl font-bold text-muted-foreground">••••••••</p>
          )}
        </div>

        {/* Account Type Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Building size={14} className="text-blue-400" />
              <p className="text-xs text-muted-foreground">Bank</p>
            </div>
            <p className="text-sm font-semibold text-blue-400">
              {showBalances ? `K${totals.bank.toLocaleString()}` : "••••"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone size={14} className="text-green-400" />
              <p className="text-xs text-muted-foreground">Mobile</p>
            </div>
            <p className="text-sm font-semibold text-green-400">
              {showBalances ? `K${totals.mobile_money.toLocaleString()}` : "••••"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Banknote size={14} className="text-yellow-400" />
              <p className="text-xs text-muted-foreground">Cash</p>
            </div>
            <p className="text-sm font-semibold text-yellow-400">
              {showBalances ? `K${totals.cash.toLocaleString()}` : "••••"}
            </p>
          </div>
        </div>
      </div>

      {/* Account List */}
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">Active Accounts</h4>
          <Badge variant="outline" className="text-xs">
            {accounts.length} accounts
          </Badge>
        </div>

        {accounts.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
            {accounts.map((account) => {
              const Icon = getAccountIcon(account.account_type);
              
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      account.account_type === 'bank' ? 'bg-blue-500/20' :
                      account.account_type === 'mobile_money' ? 'bg-green-500/20' :
                      'bg-yellow-500/20'
                    }`}>
                      <Icon size={16} className={
                        account.account_type === 'bank' ? 'text-blue-400' :
                        account.account_type === 'mobile_money' ? 'text-green-400' :
                        'text-yellow-400'
                      } />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{account.account_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(account.account_type ?? '').replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {showBalances ? `K${account.balance.toLocaleString()}` : "••••••"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Wallet className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>No accounts configured</p>
            <p className="text-xs mt-1">Go to Capital & Accounts to add accounts</p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="text-success" size={14} />
            <p>All transactions update balances in real-time</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
