import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { setExpenseStatus } from "@phinduloans/shared/services/repositories/coreWritesRepository";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@phinduloans/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@phinduloans/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@phinduloans/shared/components/ui/dialog";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { toast } from "@phinduloans/shared/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Plus, Receipt, Check, X, FileText, Download, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@phinduloans/shared/components/ui/dropdown-menu";

interface Expense {
  id: string;
  expense_date: string;
  expense_category: string;
  amount: number;
  vendor_payee: string;
  description: string | null;
  loan_id: string | null;
  branch: string | null;
  payment_method: string;
  account_id: string | null;
  attachment_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  loan_applications?: { full_name: string } | null;
  accounts?: { account_name: string } | null;
}

interface Account {
  id: string;
  account_name: string;
  balance: number;
}

interface LoanOption {
  id: string;
  full_name: string;
}

const expenseCategories = [
  { value: 'origination', label: 'Origination' },
  { value: 'collection', label: 'Collection' },
  { value: 'legal', label: 'Legal' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
];

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

const branches = [
  { value: 'head_office', label: 'Head Office' },
  { value: 'lusaka', label: 'Lusaka' },
  { value: 'kitwe', label: 'Kitwe' },
  { value: 'ndola', label: 'Ndola' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZM', { 
    style: 'currency', 
    currency: 'ZMW',
    minimumFractionDigits: 2 
  }).format(amount);
};

const AdminExpenses = () => {
  const { can } = usePermissions();
  const canCreateExpense = can("expenses", "create");
  const canApproveExpense = can("expenses", "approve");
  const queryClient = useQueryClient();
  useRealtimeInvalidate(
    ["expenses", "account_transactions"],
    [["expenses"], ["accounts"], ["account_transactions"]],
    "admin-expenses-realtime",
  );
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  const [newExpense, setNewExpense] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    expense_category: "",
    amount: 0,
    vendor_payee: "",
    description: "",
    loan_id: "",
    branch: "",
    payment_method: "bank_transfer",
    account_id: "",
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, loan_applications(full_name), accounts(account_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_name, balance')
        .eq('is_active', true);
      if (error) throw error;
      return data as Account[];
    },
  });

  // Fetch loans for linking
  const { data: loans = [] } = useQuery({
    queryKey: ['loans-for-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_applications')
        .select('id, full_name')
        .in('status', ['active', 'disbursed'])
        .order('full_name');
      if (error) throw error;
      return data as LoanOption[];
    },
  });

  // Calculate totals
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async (data: typeof newExpense) => {
      if (!canCreateExpense) throw new Error("Permission denied: expenses create");
      const { error } = await supabase.from('expenses').insert({
        expense_date: data.expense_date,
        expense_category: data.expense_category,
        amount: data.amount,
        vendor_payee: data.vendor_payee,
        description: data.description || null,
        loan_id: data.loan_id || null,
        branch: data.branch || null,
        payment_method: data.payment_method,
        account_id: data.account_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setAddExpenseOpen(false);
      setNewExpense({
        expense_date: format(new Date(), 'yyyy-MM-dd'),
        expense_category: "",
        amount: 0,
        vendor_payee: "",
        description: "",
        loan_id: "",
        branch: "",
        payment_method: "bank_transfer",
        account_id: "",
      });
      toast({ title: "Expense recorded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error recording expense", description: error.message, variant: "destructive" });
    },
  });

  // Update status mutation - uses atomic server-side RPC
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejectReason }: { id: string; status: string; rejectReason?: string }) => {
      if (status === "approved" || status === "rejected" || status === "paid") {
        if (!canApproveExpense) throw new Error("Permission denied: expenses approve");
      }

      if (status === "approved" || status === "rejected" || status === "paid") {
        await setExpenseStatus(id, status, rejectReason);
      } else {
        const { error } = await supabase.from("expenses").update({ status }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account_transactions'] });
      toast({ title: "Expense status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating expense", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/20 text-blue-400">Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-400">Paid</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.vendor_payee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.expense_category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || expense.expense_category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Expenses"
          description="Track and manage business expenses"
          actions={
          <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!canCreateExpense} title={!canCreateExpense ? "No permission to create expenses" : undefined}>
                <Plus size={16} />
                Record Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record New Expense</DialogTitle>
                <DialogDescription>Enter the expense details</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date Incurred</Label>
                  <Input
                    type="date"
                    value={newExpense.expense_date}
                    onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expense Category *</Label>
                  <Select value={newExpense.expense_category} onValueChange={(v) => setNewExpense({ ...newExpense, expense_category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (ZMW) *</Label>
                  <Input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor/Payee *</Label>
                  <Input
                    value={newExpense.vendor_payee}
                    onChange={(e) => setNewExpense({ ...newExpense, vendor_payee: e.target.value })}
                    placeholder="Who was paid?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={newExpense.payment_method} onValueChange={(v) => setNewExpense({ ...newExpense, payment_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(pm => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pay From Account</Label>
                  <Select value={newExpense.account_id} onValueChange={(v) => setNewExpense({ ...newExpense, account_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({formatCurrency(acc.balance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Linked Loan (Optional)</Label>
                  <Select value={newExpense.loan_id} onValueChange={(v) => setNewExpense({ ...newExpense, loan_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link to loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.map(loan => (
                        <SelectItem key={loan.id} value={loan.id}>{loan.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select value={newExpense.branch} onValueChange={(v) => setNewExpense({ ...newExpense, branch: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    placeholder="Additional details..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => addExpenseMutation.mutate(newExpense)} 
                  disabled={!canCreateExpense || addExpenseMutation.isPending || !newExpense.expense_category || !newExpense.vendor_payee || newExpense.amount <= 0}
                >
                  Record Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-500">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved (Unpaid)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-500">{formatCurrency(totalApproved)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {expenseCategories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Expenses ({filteredExpenses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor/Payee</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Linked Loan</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(new Date(expense.expense_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="capitalize">{expense.expense_category}</TableCell>
                    <TableCell>{expense.vendor_payee}</TableCell>
                    <TableCell className="capitalize">{expense.branch?.replace('_', ' ') || '-'}</TableCell>
                    <TableCell>{expense.loan_applications?.full_name || '-'}</TableCell>
                    <TableCell className="capitalize">{expense.payment_method.replace('_', ' ')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">Actions</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {expense.status === 'pending' && (
                            <>
                              <DropdownMenuItem
                                disabled={!canApproveExpense}
                                onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'approved' })}
                              >
                                <Check className="mr-2 h-4 w-4" /> Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!canApproveExpense}
                                onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'rejected' })}
                              >
                                <X className="mr-2 h-4 w-4" /> Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === 'approved' && (
                            <DropdownMenuItem
                              disabled={!canApproveExpense}
                              onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'paid' })}
                            >
                              <Check className="mr-2 h-4 w-4" /> Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredExpenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminExpenses;
