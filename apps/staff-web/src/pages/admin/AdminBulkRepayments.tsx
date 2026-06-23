import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { 
  Users, 
  Search, 
  Wallet, 
  CheckCircle, 
  Loader2,
  Receipt,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";

interface Borrower {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface LoanWithRepayments {
  id: string;
  loan_amount: number;
  total_repayment: number;
  status: string;
  loan_purpose: string;
  created_at: string;
  pendingRepayments: PendingRepayment[];
  totalPending: number;
}

interface PendingRepayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  installment_number: number;
  status: string;
}

interface AllocationItem {
  repaymentId: string;
  loanId: string;
  dueDate: string;
  originalAmount: number;
  allocatedAmount: number;
  installmentNumber: number;
}

const AdminBulkRepayments = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch borrowers
  const { data: borrowers, isLoading: loadingBorrowers } = useQuery({
    queryKey: ['borrowers-bulk'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Borrower[];
    },
  });

  // Fetch loans and repayments for selected borrower
  const { data: borrowerLoans, isLoading: loadingLoans } = useQuery({
    queryKey: ['borrower-loans', selectedBorrowerId],
    queryFn: async () => {
      if (!selectedBorrowerId) return [];
      
      // Get active loans
      const { data: loans, error: loansError } = await supabase
        .from('loan_applications')
        .select('id, loan_amount, total_repayment, status, loan_purpose, created_at')
        .eq('user_id', selectedBorrowerId)
        .in('status', ['active', 'disbursed']);
      
      if (loansError) throw loansError;
      if (!loans || loans.length === 0) return [];

      // Get pending repayments for these loans
      const loanIds = loans.map(l => l.id);
      const { data: repayments, error: repError } = await supabase
        .from('loan_repayments')
        .select('id, loan_id, amount, due_date, installment_number, status')
        .in('loan_id', loanIds)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (repError) throw repError;

      // Map repayments to loans
      const loansWithRepayments: LoanWithRepayments[] = loans.map(loan => {
        const loanRepayments = (repayments || []).filter(r => r.loan_id === loan.id);
        return {
          ...loan,
          pendingRepayments: loanRepayments,
          totalPending: loanRepayments.reduce((sum, r) => sum + Number(r.amount), 0),
        };
      });

      return loansWithRepayments.filter(l => l.pendingRepayments.length > 0);
    },
    enabled: !!selectedBorrowerId,
  });

  // Fetch active accounts for deposit destination
  const { data: accounts = [] } = useQuery({
    queryKey: ["active-accounts-bulk-repayments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, balance")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Calculate allocation when payment amount changes
  const calculateAllocations = () => {
    if (!borrowerLoans || !paymentAmount) return [];
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return [];

    // Collect all pending repayments sorted by due date (oldest first - FIFO)
    const allRepayments: (PendingRepayment & { loanId: string })[] = [];
    borrowerLoans.forEach(loan => {
      loan.pendingRepayments.forEach(rep => {
        allRepayments.push({ ...rep, loanId: loan.id });
      });
    });

    // Sort by due date ascending (oldest first)
    allRepayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // Allocate payment
    let remaining = amount;
    const result: AllocationItem[] = [];

    for (const rep of allRepayments) {
      if (remaining <= 0) break;
      
      const repAmount = Number(rep.amount);
      const allocated = Math.min(remaining, repAmount);
      
      if (allocated > 0) {
        result.push({
          repaymentId: rep.id,
          loanId: rep.loanId,
          dueDate: rep.due_date,
          originalAmount: repAmount,
          allocatedAmount: allocated,
          installmentNumber: rep.installment_number,
        });
        remaining -= allocated;
      }
    }

    return result;
  };

  const previewAllocations = useMemo(() => calculateAllocations(), [borrowerLoans, paymentAmount]);

  const totalOutstanding = useMemo(() => {
    return borrowerLoans?.reduce((sum, loan) => sum + loan.totalPending, 0) || 0;
  }, [borrowerLoans]);

  const totalAllocated = useMemo(() => {
    return previewAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  }, [previewAllocations]);

  // Bulk payment mutation
  const bulkPaymentMutation = useMutation({
    mutationFn: async () => {
      if (allocations.length === 0) throw new Error('No allocations to process');
      if (!destinationAccountId) throw new Error("Please select a destination account");

      const paidDate = format(new Date(), 'yyyy-MM-dd');
      const txBase = transactionRef || `BULK-${Date.now()}`;
      let processed = 0;

      // Delegate repayment accounting/status transitions to canonical RPC per installment.
      for (let idx = 0; idx < allocations.length; idx += 1) {
        const allocation = allocations[idx];
        const { data: rpcData, error: rpcError } = await supabase.rpc("record_loan_payment", {
          p_repayment_id: allocation.repaymentId,
          p_amount: allocation.allocatedAmount,
          p_payment_method: paymentMethod,
          p_account_id: destinationAccountId,
          p_transaction_reference: `${txBase}-${idx + 1}`,
          p_paid_date: paidDate,
        });
        if (rpcError) throw rpcError;
        const rpcResult = rpcData as { success?: boolean; error?: string } | null;
        if (!rpcResult?.success) {
          throw new Error(rpcResult?.error || "Failed to process bulk repayment allocation");
        }
        processed += 1;
      }

      return { processed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['borrower-loans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-repayments'] });
      queryClient.invalidateQueries({ queryKey: ['active-accounts-bulk-repayments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ 
        title: "Bulk Payment Processed", 
        description: `Successfully allocated payment across ${result.processed} installment(s)` 
      });
      setIsConfirmOpen(false);
      setPaymentAmount("");
      setTransactionRef("");
      setDestinationAccountId("");
      setAllocations([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Payment Failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleConfirmPayment = () => {
    if (previewAllocations.length === 0) {
      toast({ title: "No allocations", description: "Enter a valid payment amount", variant: "destructive" });
      return;
    }
    setAllocations(previewAllocations);
    setIsConfirmOpen(true);
  };

  const filteredBorrowers = borrowers?.filter(b => 
    b.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBorrower = borrowers?.find(b => b.id === selectedBorrowerId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bulk Repayments</h1>
            <p className="text-muted-foreground mt-1">
              Record a single payment and allocate across multiple loans
            </p>
          </div>
        </div>

        {/* Borrower Selection */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Select Borrower
            </CardTitle>
            <CardDescription>Choose a borrower to see their outstanding loans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedBorrowerId} onValueChange={setSelectedBorrowerId}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Select a borrower" />
                </SelectTrigger>
                <SelectContent>
                  {filteredBorrowers?.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.full_name || b.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBorrower && (
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <p className="font-semibold text-foreground">{selectedBorrower.full_name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{selectedBorrower.email}</p>
                {selectedBorrower.phone && (
                  <p className="text-sm text-muted-foreground">{selectedBorrower.phone}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Loans */}
        {selectedBorrowerId && (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} />
                Outstanding Loans
              </CardTitle>
              <CardDescription>
                {borrowerLoans?.length || 0} active loan(s) with pending repayments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLoans ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : borrowerLoans && borrowerLoans.length > 0 ? (
                <div className="space-y-4">
                  {borrowerLoans.map(loan => (
                    <div key={loan.id} className="p-4 rounded-xl bg-secondary/20 border border-border/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-foreground capitalize">{loan.loan_purpose} Loan</p>
                          <p className="text-sm text-muted-foreground">
                            Applied: {format(new Date(loan.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          K{loan.totalPending.toLocaleString()} pending
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-medium">K{Number(loan.loan_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Repayment</p>
                          <p className="font-medium">K{Number(loan.total_repayment).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pending Installments</p>
                          <p className="font-medium">{loan.pendingRepayments.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Next Due</p>
                          <p className="font-medium">
                            {loan.pendingRepayments[0] 
                              ? format(new Date(loan.pendingRepayments[0].due_date), 'dd MMM yyyy')
                              : 'N/A'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Summary */}
                  <div className="p-4 rounded-xl gradient-primary text-primary-foreground">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm opacity-80">Total Outstanding</p>
                        <p className="text-2xl font-bold">K{totalOutstanding.toLocaleString()}</p>
                      </div>
                      <Wallet size={32} className="opacity-50" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No outstanding loans found for this borrower</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Entry */}
        {selectedBorrowerId && borrowerLoans && borrowerLoans.length > 0 && (
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={20} />
                Enter Payment
              </CardTitle>
              <CardDescription>
                Enter the total amount received. It will be allocated to oldest installments first (FIFO).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Payment Amount (K)</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transaction Reference (Optional)</Label>
                  <Input
                    placeholder="Reference number"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Deposit To Account *</Label>
                <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account to deposit this bulk payment" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.length === 0 ? (
                      <SelectItem value="none" disabled>No active accounts available</SelectItem>
                    ) : (
                      accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.account_type}) - K{Number(acc.balance).toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Allocation Preview */}
              {previewAllocations.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Allocation Preview</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead>Installment</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Original</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewAllocations.map((alloc, idx) => {
                        const loan = borrowerLoans.find(l => l.id === alloc.loanId);
                        const isFullPayment = alloc.allocatedAmount >= alloc.originalAmount;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium capitalize">
                              {loan?.loan_purpose || 'Loan'}
                            </TableCell>
                            <TableCell>#{alloc.installmentNumber}</TableCell>
                            <TableCell>{format(new Date(alloc.dueDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell className="text-right">
                              K{alloc.originalAmount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              K{alloc.allocatedAmount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={isFullPayment ? "default" : "outline"} className={isFullPayment ? "bg-green-500/20 text-green-400" : ""}>
                                {isFullPayment ? "Full" : "Partial"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/30">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Allocated</p>
                      <p className="text-xl font-bold text-foreground">K{totalAllocated.toLocaleString()}</p>
                    </div>
                    {parseFloat(paymentAmount) > totalOutstanding && (
                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        Overpayment: K{(parseFloat(paymentAmount) - totalOutstanding).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleConfirmPayment}
                disabled={!paymentAmount || !destinationAccountId || previewAllocations.length === 0}
                className="w-full gradient-primary"
              >
                <Receipt size={18} className="mr-2" />
                Confirm & Record Payment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Payment</DialogTitle>
            <DialogDescription>
              You are about to record a payment of K{parseFloat(paymentAmount || '0').toLocaleString()} 
              for {selectedBorrower?.full_name || selectedBorrower?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will be allocated to {allocations.length} installment(s):
            </p>
            <ul className="text-sm space-y-1">
              {allocations.map((alloc, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>Installment #{alloc.installmentNumber}</span>
                  <span className="font-medium">K{alloc.allocatedAmount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkPaymentMutation.mutate()}
              disabled={bulkPaymentMutation.isPending}
              className="gradient-primary"
            >
              {bulkPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle size={18} className="mr-2" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBulkRepayments;
