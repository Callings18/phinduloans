import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logAudit, handleUnauthorized } from "@/utils/auditLog";
import { createRepaymentScheduleForLoan } from "@/utils/createRepaymentSchedule";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Banknote,
  Plus,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Wallet,
  ArrowUpRight,
  Phone,
  CreditCard,
  Building,
  Loader2,
  Send,
  RefreshCw,
  Smartphone,
} from "lucide-react";

interface Disbursement {
  id: string;
  loan_id: string;
  amount: number;
  disbursement_method: string;
  mobile_money_number: string | null;
  account_number: string | null;
  status: string;
  transaction_reference: string | null;
  disbursed_at: string | null;
  created_at: string;
  loan_applications?: {
    full_name: string;
    email: string;
    loan_amount: number;
  };
}

const AdminDisbursements = () => {
  const { can } = usePermissions();
  const canCompleteDisbursement = can("disbursement", "disburse");
  const canCreateDisbursement = can("disbursement", "create") || can("disbursement", "disburse");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string>("");
  const [formData, setFormData] = useState({
    disbursement_method: "mobile_money",
    mobile_money_number: "",
    account_number: "",
    amount: "",
    source_account_id: "", // NEW: Which account to disburse from
  });

  const queryClient = useQueryClient();

  const { data: disbursements, isLoading } = useQuery({
    queryKey: ["disbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disbursements")
        .select(`
          *,
          loan_applications (
            full_name,
            email,
            loan_amount
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Disbursement[];
    },
  });

  const { data: approvedLoans } = useQuery({
    queryKey: ["approved-loans-for-disbursement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, email, borrower_signed, admin_signed, signed_contract_url, status")
        .in("status", ["approved", "awaiting_disbursement", "contract_signing"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        full_name: string;
        loan_amount: number;
        email: string;
        borrower_signed: boolean | null;
        admin_signed: boolean | null;
        signed_contract_url: string | null;
        status: string;
      }>;
    },
  });

  // Fetch active accounts for source selection
  const { data: accounts = [] } = useQuery({
    queryKey: ["active-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type, balance")
        .eq("is_active", true)
        .order("account_name");
      
      if (error) throw error;
      return data;
    },
  });

  const createDisbursementMutation = useMutation({
    mutationFn: async () => {
      const loan = approvedLoans?.find((l) => l.id === selectedLoan);
      if (!loan) throw new Error("Loan not found");

      // V1.0.1: Simplified flow - contract check only requires uploaded PDF or approval signatures
      const hasContract = loan.signed_contract_url || loan.borrower_signed || loan.admin_signed;
      if (!hasContract) {
        throw new Error("Cannot disburse: Please upload a signed contract or approve the loan first from the Applications page.");
      }

      if (!formData.source_account_id) {
        throw new Error("Please select a source account for disbursement");
      }

      const disbursementAmount = Number(formData.amount) || loan.loan_amount;
      
      // Check account balance
      const sourceAccount = accounts.find(a => a.id === formData.source_account_id);
      if (!sourceAccount) throw new Error("Source account not found");
      if (sourceAccount.balance < disbursementAmount) {
        throw new Error(`Insufficient balance in ${sourceAccount.account_name}. Available: K${sourceAccount.balance.toLocaleString()}`);
      }

      // Create disbursement record with source account (status pending).
      // Account deduction happens only when status is set to "completed" (via DB trigger).
      const { data: inserted, error: disbError } = await supabase.from("disbursements").insert({
        loan_id: selectedLoan,
        amount: disbursementAmount,
        disbursement_method: formData.disbursement_method,
        mobile_money_number: formData.disbursement_method === "mobile_money" ? formData.mobile_money_number : null,
        account_number: formData.disbursement_method === "bank_transfer" ? formData.account_number : null,
        status: "pending",
        source_account_id: formData.source_account_id,
      }).select("id").single();

      if (disbError) throw disbError;

      await logAudit({
        action: "DISBURSE_CREATE",
        entity_type: "disbursement",
        entity_id: inserted?.id ?? selectedLoan,
        module: "disbursement",
        new_values: { loan_id: selectedLoan, amount: disbursementAmount, status: "pending" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["approved-loans-for-disbursement"] });
      queryClient.invalidateQueries({ queryKey: ["active-accounts"] }); // Refresh account balances
      queryClient.invalidateQueries({ queryKey: ["accounts"] }); // Refresh all accounts
      toast.success("Disbursement created. Mark as completed to deduct from the source account.");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: async (error: any) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "disbursement",
        entity_id: selectedLoan || "",
        module: "disbursement",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to create disbursement"));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "completed") {
        updateData.disbursed_at = new Date().toISOString();
        updateData.transaction_reference = `TXN-${Date.now()}`;
      }

      const { error } = await supabase
        .from("disbursements")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Update loan status and auto-generate repayment schedule if disbursed
      if (status === "completed") {
        const disbursement = disbursements?.find((d) => d.id === id);
        if (disbursement) {
          await supabase
            .from("loan_applications")
            .update({ status: "disbursed" })
            .eq("id", disbursement.loan_id);

          const { data: loan, error: loanErr } = await supabase
            .from("loan_applications")
            .select("id, user_id, loan_term_months, total_repayment, monthly_payment, loan_product_id, term_unit")
            .eq("id", disbursement.loan_id)
            .single();
          if (!loanErr && loan) {
            await createRepaymentScheduleForLoan(
              {
                id: loan.id,
                user_id: loan.user_id,
                loan_term_months: loan.loan_term_months,
                total_repayment: loan.total_repayment,
                monthly_payment: loan.monthly_payment,
                loan_product_id: loan.loan_product_id,
                term_unit: (loan as any).term_unit,
              },
              supabase
            );
          }
        }
      }

      await logAudit({
        action: status === "completed" ? "DISBURSE_COMPLETE" : "DISBURSE_STATUS_UPDATE",
        entity_type: "disbursement",
        entity_id: id,
        module: "disbursement",
        new_values: { status },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["disbursements"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["active-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-repayments"] });
      toast.success(variables.status === "completed" ? "Disbursement completed, schedule generated, and account balance updated" : "Disbursement status updated");
    },
    onError: async (error: any, variables) => {
      const handled = await handleUnauthorized(error, {
        entity_type: "disbursement",
        entity_id: variables?.id ?? "",
        module: "disbursement",
      });
      toast.error(handled ? "You don't have permission to perform this action." : (error.message || "Failed to update status"));
    },
  });

  const resetForm = () => {
    setFormData({
      disbursement_method: "mobile_money",
      mobile_money_number: "",
      account_number: "",
      amount: "",
      source_account_id: "",
    });
    setSelectedLoan("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) {
      toast.error("Please select a loan");
      return;
    }
    createDisbursementMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      processing: { color: "bg-info/20 text-info border-info/30", icon: RefreshCw },
      completed: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      failed: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  const filteredDisbursements = disbursements?.filter((d) => {
    const matchesSearch =
      d.loan_applications?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: disbursements?.length || 0,
    pending: disbursements?.filter((d) => d.status === "pending").length || 0,
    completed: disbursements?.filter((d) => d.status === "completed").length || 0,
    totalAmount: disbursements
      ?.filter((d) => d.status === "completed")
      .reduce((sum, d) => sum + Number(d.amount), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Disbursements</h1>
            <p className="text-muted-foreground mt-1">
              Track and manage loan disbursements
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary shadow-button" disabled={!canCreateDisbursement}
                title={!canCreateDisbursement ? "You don't have permission to disburse funds" : undefined}>
                <Plus size={18} className="mr-2" />
                New Disbursement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Disbursement</DialogTitle>
                <DialogDescription>
                  Disburse funds to an approved loan application
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Approved Loan *</Label>
                  <Select value={selectedLoan} onValueChange={setSelectedLoan}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a loan to disburse" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedLoans?.length === 0 ? (
                        <SelectItem value="none" disabled>No approved loans available</SelectItem>
                      ) : (
                        approvedLoans?.map((loan) => {
                          const hasContract = loan.signed_contract_url || loan.borrower_signed || loan.admin_signed;
                          const isAwaitingDisbursement = loan.status === "awaiting_disbursement";
                          
                          return (
                            <SelectItem key={loan.id} value={loan.id}>
                              <div className="flex items-center gap-2">
                                {isAwaitingDisbursement || hasContract ? (
                                  <CheckCircle size={14} className="text-success" />
                                ) : (
                                  <Clock size={14} className="text-warning" />
                                )}
                                <span>{loan.full_name} - K{Number(loan.loan_amount).toLocaleString()}</span>
                                {(isAwaitingDisbursement || hasContract) && (
                                  <span className="text-xs text-success">(Ready)</span>
                                )}
                                {!hasContract && !isAwaitingDisbursement && (
                                  <span className="text-xs text-warning">(No contract)</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Contract signing status alert */}
                  {selectedLoan && (() => {
                    const loan = approvedLoans?.find(l => l.id === selectedLoan);
                    if (!loan) return null;
                    const hasContract = loan.signed_contract_url || loan.borrower_signed || loan.admin_signed;
                    
                    if (!hasContract) {
                      return (
                        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                          <div className="flex items-start gap-2">
                            <Clock size={16} className="text-warning mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-warning">No Contract Found</p>
                              <p className="text-xs text-muted-foreground">
                                Please upload a signed contract or approve the loan from the Applications page first.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-success" />
                          <p className="text-sm font-medium text-success">Ready for disbursement</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* NEW: Source Account Selection */}
                <div className="space-y-2">
                  <Label>Source Account (Disburse From) *</Label>
                  <Select
                    value={formData.source_account_id}
                    onValueChange={(value) => setFormData({ ...formData, source_account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account to withdraw from" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <SelectItem value="none" disabled>No active accounts available</SelectItem>
                      ) : (
                        accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              {account.account_type === 'bank' && <Building size={14} />}
                              {account.account_type === 'mobile_money' && <Smartphone size={14} />}
                              {account.account_type === 'cash' && <Banknote size={14} />}
                              <span>{account.account_name}</span>
                              <span className="text-xs text-muted-foreground">
                                (K{account.balance.toLocaleString()})
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Money will be withdrawn from this account
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Disbursement Method *</Label>
                  <Select
                    value={formData.disbursement_method}
                    onValueChange={(value) => setFormData({ ...formData, disbursement_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          Mobile Money
                        </div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2">
                          <Building size={14} />
                          Bank Transfer
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.disbursement_method === "mobile_money" && (
                  <div className="space-y-2">
                    <Label>Mobile Money Number *</Label>
                    <Input
                      value={formData.mobile_money_number}
                      onChange={(e) => setFormData({ ...formData, mobile_money_number: e.target.value })}
                      placeholder="+260 967 713 001"
                    />
                  </div>
                )}

                {formData.disbursement_method === "bank_transfer" && (
                  <div className="space-y-2">
                    <Label>Account Number *</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder="Enter account number"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Amount (leave blank for full loan amount)</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="Enter amount"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-primary"
                    disabled={createDisbursementMutation.isPending}
                  >
                    {createDisbursementMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Send size={16} className="mr-2" />
                    Create Disbursement
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Banknote className="text-primary-foreground" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Disbursements</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Clock className="text-warning" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="text-success" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Wallet className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">K{stats.totalAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Disbursed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Disbursements Table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Disbursement Records</CardTitle>
            <CardDescription>All loan disbursement transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredDisbursements?.length === 0 ? (
              <div className="py-12 text-center">
                <Banknote className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No disbursements found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first disbursement to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Borrower</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Amount</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Method</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Date</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisbursements?.map((disbursement) => (
                      <tr key={disbursement.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {disbursement.loan_applications?.full_name || "N/A"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {disbursement.loan_applications?.email}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground">
                            K{Number(disbursement.amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {disbursement.disbursement_method === "mobile_money" ? (
                              <Phone size={14} className="text-muted-foreground" />
                            ) : (
                              <Building size={14} className="text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground capitalize">
                              {disbursement.disbursement_method.replace("_", " ")}
                            </span>
                          </div>
                          {disbursement.mobile_money_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {disbursement.mobile_money_number}
                            </p>
                          )}
                          {disbursement.account_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {disbursement.account_number}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4">{getStatusBadge(disbursement.status || "pending")}</td>
                        <td className="py-4 px-4">
                          <span className="text-muted-foreground text-sm">
                            {format(new Date(disbursement.created_at), "MMM d, yyyy")}
                          </span>
                          {disbursement.transaction_reference && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ref: {disbursement.transaction_reference}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {disbursement.status === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              {canCompleteDisbursement ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-success/50 text-success hover:bg-success/10"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: disbursement.id,
                                        status: "completed",
                                      })
                                    }
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <CheckCircle size={14} className="mr-1" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: disbursement.id,
                                        status: "failed",
                                      })
                                    }
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <XCircle size={14} className="mr-1" />
                                    Fail
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">Accounts only</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDisbursements;