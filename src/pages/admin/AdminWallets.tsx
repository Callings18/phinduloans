import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  Search,
  Plus,
  Minus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  DollarSign,
  User,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface WalletAccount {
  id: string;
  user_id: string;
  available_balance: number;
  pending_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  is_active: boolean;
  created_at: string;
  full_name?: string;
  email?: string;
  phone?: string;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  status: string;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  withdrawal_method: string;
  account_details: any;
  status: string;
  admin_notes: string;
  created_at: string;
  full_name?: string;
  email?: string;
  available_balance?: number;
}

const AdminWallets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("wallets");
  const [selectedWallet, setSelectedWallet] = useState<WalletAccount | null>(null);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [isViewTransactionsOpen, setIsViewTransactionsOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"credit" | "debit">("credit");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [withdrawalAction, setWithdrawalAction] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");

  const queryClient = useQueryClient();

  // Fetch all wallets with user details
  const { data: wallets, isLoading: loadingWallets } = useQuery({
    queryKey: ["wallet-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_accounts")
        .select(`
          *,
          profiles!wallet_accounts_user_id_fkey (
            full_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return data.map(w => ({
        ...w,
        full_name: w.profiles?.full_name,
        email: w.profiles?.email,
        phone: w.profiles?.phone,
      }));
    },
  });

  // Fetch withdrawal requests
  const { data: withdrawalRequests, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ["withdrawal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_withdrawal_requests")
        .select(`
          *,
          profiles!wallet_withdrawal_requests_user_id_fkey (
            full_name,
            email
          ),
          wallet_accounts!wallet_withdrawal_requests_wallet_id_fkey (
            available_balance
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return data.map(w => ({
        ...w,
        full_name: w.profiles?.full_name,
        email: w.profiles?.email,
        available_balance: w.wallet_accounts?.available_balance,
      }));
    },
  });

  // Fetch transactions for selected wallet
  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["wallet-transactions", selectedWallet?.id],
    queryFn: async () => {
      if (!selectedWallet) return [];
      
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", selectedWallet.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedWallet,
  });

  // Process transaction mutation (credit/debit)
  const transactionMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(transactionAmount);
      if (!selectedWallet || !amount || amount <= 0) {
        throw new Error("Invalid transaction details");
      }

      const functionName = transactionType === "credit" ? "credit_wallet" : "debit_wallet";
      
      const { data, error } = await supabase.rpc(functionName, {
        p_user_id: selectedWallet.user_id,
        p_amount: amount,
        p_transaction_type: transactionType,
        p_reference_type: "manual",
        p_description: transactionDescription || `Manual ${transactionType} by admin`,
        p_processed_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      toast.success(`Successfully ${transactionType === "credit" ? "credited" : "debited"} wallet`);
      setIsTransactionDialogOpen(false);
      setTransactionAmount("");
      setTransactionDescription("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Transaction failed");
    },
  });

  // Process withdrawal request mutation
  const processWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWithdrawal || !withdrawalAction) {
        throw new Error("Invalid withdrawal request");
      }

      const updates: any = {
        status: withdrawalAction,
        admin_notes: withdrawalNotes,
        processed_by: (await supabase.auth.getUser()).data.user?.id,
        processed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("wallet_withdrawal_requests")
        .update(updates)
        .eq("id", selectedWithdrawal.id);

      if (error) throw error;

      // If approved, debit the wallet
      if (withdrawalAction === "approved") {
        await supabase.rpc("debit_wallet", {
          p_user_id: selectedWithdrawal.user_id,
          p_amount: selectedWithdrawal.amount,
          p_transaction_type: "withdrawal",
          p_reference_type: "withdrawal_request",
          p_reference_id: selectedWithdrawal.id,
          p_description: `Withdrawal via ${selectedWithdrawal.withdrawal_method}`,
          p_processed_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-accounts"] });
      toast.success(`Withdrawal request ${withdrawalAction}`);
      setIsWithdrawalDialogOpen(false);
      setSelectedWithdrawal(null);
      setWithdrawalAction("");
      setWithdrawalNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process withdrawal");
    },
  });

  const filteredWallets = wallets?.filter((wallet) =>
    wallet.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wallet.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWithdrawals = withdrawalRequests?.filter((req) =>
    req.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalWallets: wallets?.length || 0,
    activeWallets: wallets?.filter(w => w.is_active).length || 0,
    totalBalance: wallets?.reduce((sum, w) => sum + Number(w.available_balance), 0) || 0,
    pendingWithdrawals: withdrawalRequests?.filter(r => r.status === "pending").length || 0,
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "credit":
        return ArrowDownCircle;
      case "debit":
      case "withdrawal":
        return ArrowUpCircle;
      case "loan_payment":
        return DollarSign;
      default:
        return RefreshCw;
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: any }> = {
      completed: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      failed: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
      approved: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      rejected: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={config.color}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Wallet className="text-primary" size={32} />
            Wallet Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage borrower wallets, transactions, and withdrawal requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Wallets</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalWallets}</p>
                </div>
                <Wallet className="text-primary" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Wallets</p>
                  <p className="text-2xl font-bold text-foreground">{stats.activeWallets}</p>
                </div>
                <CheckCircle className="text-success" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-bold text-foreground">K{stats.totalBalance.toLocaleString()}</p>
                </div>
                <TrendingUp className="text-primary" size={32} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Withdrawals</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pendingWithdrawals}</p>
                </div>
                <Clock className="text-warning" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="wallets">Wallet Accounts</TabsTrigger>
            <TabsTrigger value="withdrawals">
              Withdrawal Requests
              {stats.pendingWithdrawals > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {stats.pendingWithdrawals}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            {loadingWallets ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredWallets && filteredWallets.length > 0 ? (
              <Card className="glass border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Available Balance</TableHead>
                      <TableHead>Total Deposited</TableHead>
                      <TableHead>Total Withdrawn</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWallets.map((wallet) => (
                      <TableRow key={wallet.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <User size={18} className="text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{wallet.full_name}</p>
                              <p className="text-sm text-muted-foreground">{wallet.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-primary text-lg">
                            K{Number(wallet.available_balance).toLocaleString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-success">K{Number(wallet.total_deposited).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-muted-foreground">K{Number(wallet.total_withdrawn).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          {wallet.is_active ? (
                            <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setIsViewTransactionsOpen(true);
                              }}
                            >
                              <Eye size={16} className="mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-success"
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setTransactionType("credit");
                                setIsTransactionDialogOpen(true);
                              }}
                            >
                              <Plus size={16} className="mr-1" />
                              Credit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setTransactionType("debit");
                                setIsTransactionDialogOpen(true);
                              }}
                            >
                              <Minus size={16} className="mr-1" />
                              Debit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="glass border-border/50">
                <CardContent className="py-12 text-center">
                  <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No wallets found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals" className="space-y-4">
            {loadingWithdrawals ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredWithdrawals && filteredWithdrawals.length > 0 ? (
              <Card className="glass border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Available Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWithdrawals.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{request.full_name}</p>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-lg">K{Number(request.amount).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {request.withdrawal_method.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-muted-foreground">K{Number(request.available_balance).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{format(new Date(request.created_at), "MMM dd, yyyy")}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedWithdrawal(request);
                                setIsWithdrawalDialogOpen(true);
                              }}
                            >
                              <Eye size={16} className="mr-1" />
                              Process
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card className="glass border-border/50">
                <CardContent className="py-12 text-center">
                  <ArrowUpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No withdrawal requests found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transactionType === "credit" ? <Plus className="text-success" /> : <Minus className="text-destructive" />}
              {transactionType === "credit" ? "Credit" : "Debit"} Wallet
            </DialogTitle>
            <DialogDescription>
              {selectedWallet && `${transactionType === "credit" ? "Add funds to" : "Remove funds from"} ${selectedWallet.full_name}'s wallet`}
            </DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-primary">K{Number(selectedWallet.available_balance).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <Label>Amount (ZMW)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter transaction description..."
                  value={transactionDescription}
                  onChange={(e) => setTransactionDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsTransactionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => transactionMutation.mutate()}
                  disabled={!transactionAmount || parseFloat(transactionAmount) <= 0 || transactionMutation.isPending}
                  className={transactionType === "credit" ? "bg-success hover:bg-success/90" : ""}
                >
                  {transactionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {transactionType === "credit" ? "Credit" : "Debit"} Wallet
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Transactions Dialog */}
      <Dialog open={isViewTransactionsOpen} onOpenChange={setIsViewTransactionsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Transaction History</DialogTitle>
            <DialogDescription>
              {selectedWallet && `${selectedWallet.full_name}'s wallet transactions`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto">
            {selectedWallet && (
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-xl font-bold text-primary">K{Number(selectedWallet.available_balance).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-xl font-bold text-foreground">{transactions?.length || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {loadingTransactions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn: WalletTransaction) => {
                  const Icon = getTransactionIcon(txn.transaction_type);
                  const isCredit = ["credit", "refund"].includes(txn.transaction_type);

                  return (
                    <div key={txn.id} className="p-4 rounded-xl border border-border/50 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full ${isCredit ? "bg-success/20" : "bg-destructive/20"} flex items-center justify-center`}>
                            <Icon size={18} className={isCredit ? "text-success" : "text-destructive"} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground capitalize">{txn.transaction_type.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground">{txn.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(txn.created_at), "MMM dd, yyyy 'at' HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${isCredit ? "text-success" : "text-destructive"}`}>
                            {isCredit ? "+" : "-"}K{Number(txn.amount).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Balance: K{Number(txn.balance_after).toLocaleString()}</p>
                          {getStatusBadge(txn.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Process Withdrawal Dialog */}
      <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Withdrawal Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this withdrawal request
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <p className="font-medium text-foreground mb-2">{selectedWithdrawal.full_name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Withdrawal Amount</p>
                    <p className="text-lg font-bold text-foreground">K{Number(selectedWithdrawal.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available Balance</p>
                    <p className="text-lg font-bold text-primary">K{Number(selectedWithdrawal.available_balance).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="text-sm font-medium capitalize">{selectedWithdrawal.withdrawal_method.replace('_', ' ')}</p>
                  {selectedWithdrawal.account_details && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Account Details</p>
                      <pre className="text-xs bg-muted/50 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(selectedWithdrawal.account_details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action *</Label>
                <Select value={withdrawalAction} onValueChange={setWithdrawalAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Enter any notes about this withdrawal..."
                  value={withdrawalNotes}
                  onChange={(e) => setWithdrawalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {Number(selectedWithdrawal.amount) > Number(selectedWithdrawal.available_balance) && (
                <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive text-sm">
                  <p className="font-medium">⚠️ Insufficient Balance</p>
                  <p>The withdrawal amount exceeds the available balance.</p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsWithdrawalDialogOpen(false);
                    setSelectedWithdrawal(null);
                    setWithdrawalAction("");
                    setWithdrawalNotes("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => processWithdrawalMutation.mutate()}
                  disabled={!withdrawalAction || processWithdrawalMutation.isPending}
                  className={withdrawalAction === "approved" ? "bg-success hover:bg-success/90" : ""}
                >
                  {processWithdrawalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {withdrawalAction === "approved" ? "Approve" : "Reject"} Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWallets;
