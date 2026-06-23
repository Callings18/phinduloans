import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@phinduloans/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@phinduloans/shared/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { toast } from "@phinduloans/shared/hooks/use-toast";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Wallet, Building, Smartphone, Banknote, Edit, History, TrendingUp, PiggyBank } from "lucide-react";
import { format } from "date-fns";
import AccountsPnLReport from "@/components/admin/AccountsPnLReport";
import AddOtherIncomeDialog from "@/components/admin/AddOtherIncomeDialog";

interface Account {
  id: string;
  account_name: string;
  account_type: string;
  account_number: string | null;
  balance: number;
  currency: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Transaction {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  source: string | null;
  destination: string | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
  accounts?: Account;
}

const accountTypeIcons: Record<string, any> = {
  bank: Building,
  mobile_money: Smartphone,
  cash: Banknote,
  petty_cash: Wallet,
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZM', { 
    style: 'currency', 
    currency: 'ZMW',
    minimumFractionDigits: 2 
  }).format(amount);
};

const AdminAccounts = () => {
  const queryClient = useQueryClient();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  
  // Form states
  const [newAccount, setNewAccount] = useState({
    account_name: "",
    account_type: "bank",
    account_number: "",
    balance: 0,
    notes: "",
  });
  
  const [fundsData, setFundsData] = useState({
    account_id: "",
    amount: 0,
    source: "",
    notes: "",
    transaction_type: "deposit" as "deposit" | "withdrawal",
  });
  
  const [transferData, setTransferData] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: 0,
    notes: "",
  });

  // Fetch accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('account_name');
      if (error) throw error;
      return data as Account[];
    },
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['account_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_transactions')
        .select('*, accounts(*)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.is_active ? acc.balance : 0), 0);

  // Add account mutation
  const addAccountMutation = useMutation({
    mutationFn: async (data: typeof newAccount) => {
      const { error } = await supabase.from('accounts').insert({
        account_name: data.account_name,
        account_type: data.account_type,
        account_number: data.account_number || null,
        balance: data.balance,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setAddAccountOpen(false);
      setNewAccount({ account_name: "", account_type: "bank", account_number: "", balance: 0, notes: "" });
      toast({ title: "Account created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating account", description: error.message, variant: "destructive" });
    },
  });

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async (data: { id: string; balance: number; notes: string }) => {
      // Fetch fresh account data to avoid stale data issues
      const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', data.id)
        .single();
      
      if (fetchError || !account) throw new Error("Account not found");
      
      // If balance changed, create a transaction
      if (data.balance !== account.balance) {
        const diff = data.balance - account.balance;
        const { error: txError } = await supabase.from('account_transactions').insert({
          account_id: data.id,
          transaction_type: diff > 0 ? 'adjustment_credit' : 'adjustment_debit',
          amount: Math.abs(diff),
          balance_before: account.balance,
          balance_after: data.balance,
          source: 'Manual Adjustment',
          notes: data.notes || 'Balance adjustment',
        });
        if (txError) throw txError;
      }
      
      const { error } = await supabase
        .from('accounts')
        .update({ balance: data.balance, notes: data.notes || null, updated_at: new Date().toISOString() })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_transactions'] });
      setEditAccountOpen(false);
      setSelectedAccount(null);
      toast({ title: "Account updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating account", description: error.message, variant: "destructive" });
    },
  });

  // Add/Withdraw funds mutation
  const fundsMutation = useMutation({
    mutationFn: async (data: typeof fundsData) => {
      // Fetch fresh account data to avoid stale balance issues
      const { data: account, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', data.account_id)
        .single();
      
      if (fetchError || !account) throw new Error("Account not found");
      
      const newBalance = data.transaction_type === 'deposit' 
        ? account.balance + data.amount 
        : account.balance - data.amount;
      
      if (newBalance < 0) throw new Error("Insufficient funds");
      
      // Create transaction
      const { error: txError } = await supabase.from('account_transactions').insert({
        account_id: data.account_id,
        transaction_type: data.transaction_type,
        amount: data.amount,
        balance_before: account.balance,
        balance_after: newBalance,
        source: data.transaction_type === 'deposit' ? data.source : null,
        destination: data.transaction_type === 'withdrawal' ? data.source : null,
        reference_type: 'capital_injection',
        notes: data.notes,
      });
      if (txError) throw txError;
      
      // Update balance
      const { error: accError } = await supabase
        .from('accounts')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', data.account_id);
      if (accError) throw accError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_transactions'] });
      setAddFundsOpen(false);
      setFundsData({ account_id: "", amount: 0, source: "", notes: "", transaction_type: "deposit" });
      toast({ title: "Transaction completed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error processing transaction", description: error.message, variant: "destructive" });
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (data: typeof transferData) => {
      // Fetch fresh account data to avoid stale balance issues
      const { data: fromAccount, error: fromErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', data.from_account_id)
        .single();
      
      const { data: toAccount, error: toErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', data.to_account_id)
        .single();
      
      if (fromErr || !fromAccount || toErr || !toAccount) throw new Error("Account not found");
      if (fromAccount.balance < data.amount) throw new Error("Insufficient funds");
      
      const fromNewBalance = fromAccount.balance - data.amount;
      const toNewBalance = toAccount.balance + data.amount;
      
      // Create outgoing transaction
      const { error: txOutError } = await supabase.from('account_transactions').insert({
        account_id: data.from_account_id,
        transaction_type: 'transfer_out',
        amount: data.amount,
        balance_before: fromAccount.balance,
        balance_after: fromNewBalance,
        destination: toAccount.account_name,
        reference_type: 'transfer',
        notes: data.notes,
      });
      if (txOutError) throw txOutError;
      
      // Create incoming transaction
      const { error: txInError } = await supabase.from('account_transactions').insert({
        account_id: data.to_account_id,
        transaction_type: 'transfer_in',
        amount: data.amount,
        balance_before: toAccount.balance,
        balance_after: toNewBalance,
        source: fromAccount.account_name,
        reference_type: 'transfer',
        notes: data.notes,
      });
      if (txInError) throw txInError;
      
      // Update balances
      const { error: fromUpdateErr } = await supabase
        .from('accounts')
        .update({ balance: fromNewBalance, updated_at: new Date().toISOString() })
        .eq('id', data.from_account_id);
      if (fromUpdateErr) throw fromUpdateErr;
      
      const { error: toUpdateErr } = await supabase
        .from('accounts')
        .update({ balance: toNewBalance, updated_at: new Date().toISOString() })
        .eq('id', data.to_account_id);
      if (toUpdateErr) throw toUpdateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_transactions'] });
      setTransferOpen(false);
      setTransferData({ from_account_id: "", to_account_id: "", amount: 0, notes: "" });
      toast({ title: "Transfer completed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error processing transfer", description: error.message, variant: "destructive" });
    },
  });

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'transfer_in':
      case 'repayment':
      case 'adjustment_credit':
        return <Badge className="bg-green-500/20 text-green-400">+</Badge>;
      case 'withdrawal':
      case 'transfer_out':
      case 'disbursement':
      case 'adjustment_debit':
        return <Badge className="bg-red-500/20 text-red-400">-</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Capital & Accounts"
          description="Manage your funds and wallets"
          actions={
            <>
            <AddOtherIncomeDialog />
            <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowDownLeft size={16} />
                  Add Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add or Withdraw Funds</DialogTitle>
                  <DialogDescription>Record a deposit or withdrawal to/from an account</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <Select value={fundsData.transaction_type} onValueChange={(v: "deposit" | "withdrawal") => setFundsData({ ...fundsData, transaction_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit (Add Funds)</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal (Remove Funds)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={fundsData.account_id} onValueChange={(v) => setFundsData({ ...fundsData, account_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.is_active).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (ZMW)</Label>
                    <Input
                      type="number"
                      value={fundsData.amount}
                      onChange={(e) => setFundsData({ ...fundsData, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{fundsData.transaction_type === 'deposit' ? 'Source of Funds' : 'Destination'}</Label>
                    <Input
                      value={fundsData.source}
                      onChange={(e) => setFundsData({ ...fundsData, source: e.target.value })}
                      placeholder={fundsData.transaction_type === 'deposit' ? "e.g., Capital injection, Bank deposit" : "e.g., Bank transfer, Cash withdrawal"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={fundsData.notes}
                      onChange={(e) => setFundsData({ ...fundsData, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddFundsOpen(false)}>Cancel</Button>
                  <Button onClick={() => fundsMutation.mutate(fundsData)} disabled={fundsMutation.isPending}>
                    {fundsData.transaction_type === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft size={16} />
                  Transfer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer Between Accounts</DialogTitle>
                  <DialogDescription>Move funds from one account to another</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>From Account</Label>
                    <Select value={transferData.from_account_id} onValueChange={(v) => setTransferData({ ...transferData, from_account_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.is_active).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Account</Label>
                    <Select value={transferData.to_account_id} onValueChange={(v) => setTransferData({ ...transferData, to_account_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.is_active && a.id !== transferData.from_account_id).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.account_name} ({formatCurrency(acc.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (ZMW)</Label>
                    <Input
                      type="number"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({ ...transferData, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={transferData.notes}
                      onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                      placeholder="Reason for transfer..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
                  <Button onClick={() => transferMutation.mutate(transferData)} disabled={transferMutation.isPending}>
                    Transfer Funds
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={16} />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Account</DialogTitle>
                  <DialogDescription>Create a new account or wallet</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input
                      value={newAccount.account_name}
                      onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                      placeholder="e.g., Main Bank Account"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={newAccount.account_type} onValueChange={(v) => setNewAccount({ ...newAccount, account_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank Account</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="petty_cash">Petty Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number (Optional)</Label>
                    <Input
                      value={newAccount.account_number}
                      onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Opening Balance (ZMW)</Label>
                    <Input
                      type="number"
                      value={newAccount.balance}
                      onChange={(e) => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newAccount.notes}
                      onChange={(e) => setNewAccount({ ...newAccount, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddAccountOpen(false)}>Cancel</Button>
                  <Button onClick={() => addAccountMutation.mutate(newAccount)} disabled={addAccountMutation.isPending}>
                    Create Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </>
          }
        />

        {/* Total Balance Card */}
        <Card className="gradient-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground/80 text-sm">Total Capital</p>
                <p className="text-4xl font-bold">{formatCurrency(totalBalance)}</p>
              </div>
              <Wallet className="h-12 w-12 text-primary-foreground/40" />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
            <TabsTrigger value="pnl" className="gap-1"><TrendingUp className="h-4 w-4" /> Profit & Loss</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const Icon = accountTypeIcons[account.account_type] || Wallet;
                return (
                  <Card key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{account.account_name}</CardTitle>
                            <CardDescription className="capitalize">{account.account_type.replace('_', ' ')}</CardDescription>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedAccount(account);
                            setEditAccountOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
                      {account.account_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {account.account_number}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source/Destination</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{format(new Date(tx.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        <TableCell>{tx.accounts?.account_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionBadge(tx.transaction_type)}
                            <span className="capitalize">{tx.transaction_type.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>{tx.source || tx.destination || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.balance_after)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{tx.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pnl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" /> Profit & Loss
                </CardTitle>
                <CardDescription>Income, expenses, and net profit by date range and account</CardDescription>
              </CardHeader>
              <CardContent>
                <AccountsPnLReport />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Account Dialog */}
        <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
              <DialogDescription>Update account balance and notes</DialogDescription>
            </DialogHeader>
            {selectedAccount && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input value={selectedAccount.account_name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Current Balance (ZMW)</Label>
                  <Input
                    type="number"
                    value={selectedAccount.balance}
                    onChange={(e) => setSelectedAccount({ ...selectedAccount, balance: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Changing the balance will create an adjustment transaction
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedAccount.notes || ''}
                    onChange={(e) => setSelectedAccount({ ...selectedAccount, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditAccountOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => selectedAccount && updateAccountMutation.mutate({
                  id: selectedAccount.id,
                  balance: selectedAccount.balance,
                  notes: selectedAccount.notes || '',
                })} 
                disabled={updateAccountMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAccounts;
