import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays, addMonths } from "date-fns";
import {
  CreditCard,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Eye,
  DollarSign,
  Calendar,
  User,
  Wallet,
  TrendingUp,
  Activity,
  Plus,
  UserPlus,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  total_repayment: number;
  monthly_payment: number;
  status: string;
  created_at: string;
  loan_purpose: string;
  employment_type: string;
  nrc_number: string;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  installment_number: number | null;
}

interface Borrower {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  processing_fee_percent: number | null;
}

const AdminLoans = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  
  // Add Loan Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [loanTermMonths, setLoanTermMonths] = useState<string>("");
  const [loanPurpose, setLoanPurpose] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("employed");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");

  const queryClient = useQueryClient();

  // Fetch active/disbursed loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ["admin-active-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .in("status", ["active", "disbursed", "completed", "defaulted"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loan[];
    },
  });

  // Fetch repayments for selected loan
  const { data: loanRepayments } = useQuery({
    queryKey: ["loan-repayments", selectedLoan?.id],
    queryFn: async () => {
      if (!selectedLoan) return [];
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", selectedLoan.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Repayment[];
    },
    enabled: !!selectedLoan,
  });

  // Fetch borrowers for the add loan dialog
  const { data: borrowers } = useQuery({
    queryKey: ["admin-borrowers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Borrower[];
    },
  });

  // Fetch loan products for the add loan dialog
  const { data: loanProducts } = useQuery({
    queryKey: ["admin-loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Get selected borrower and product details
  const selectedBorrower = borrowers?.find(b => b.id === selectedBorrowerId);
  const selectedProduct = loanProducts?.find(p => p.id === selectedProductId);

  // Calculate loan details based on inputs
  const calculateLoanDetails = () => {
    if (!selectedProduct || !loanAmount || !loanTermMonths) return null;
    
    const principal = Number(loanAmount);
    const rate = selectedProduct.interest_rate;
    const months = Number(loanTermMonths);
    const processingFee = selectedProduct.processing_fee_percent ? principal * (selectedProduct.processing_fee_percent / 100) : 0;
    
    const interest = principal * (rate / 100) * months;
    const totalRepayment = principal + interest + processingFee;
    const monthlyPayment = totalRepayment / months;
    
    return {
      principal,
      interest,
      processingFee,
      totalRepayment,
      monthlyPayment,
      rate,
    };
  };

  const loanDetails = calculateLoanDetails();

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower || !selectedProduct || !loanDetails) {
        throw new Error("Please fill in all required fields");
      }

      // Create loan application
      const { data: loanApp, error: loanError } = await supabase
        .from("loan_applications")
        .insert({
          user_id: selectedBorrowerId,
          full_name: selectedBorrower.full_name || "",
          email: selectedBorrower.email,
          phone: selectedBorrower.phone || "",
          nrc_number: selectedBorrower.nrc_number || "",
          address: selectedBorrower.address,
          city: selectedBorrower.city,
          loan_amount: loanDetails.principal,
          loan_term_months: Number(loanTermMonths),
          interest_rate: loanDetails.rate,
          monthly_payment: loanDetails.monthlyPayment,
          total_repayment: loanDetails.totalRepayment,
          monthly_income: Number(monthlyIncome) || 0,
          employment_type: employmentType as "employed" | "self_employed" | "contract" | "other",
          loan_purpose: loanPurpose,
          loan_product_id: selectedProductId,
          status: "disbursed", // Directly disbursed since admin is creating
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // Generate repayment schedule
      const repayments = [];
      const startDate = new Date();
      for (let i = 1; i <= Number(loanTermMonths); i++) {
        repayments.push({
          loan_id: loanApp.id,
          user_id: selectedBorrowerId,
          amount: loanDetails.monthlyPayment,
          due_date: format(addMonths(startDate, i), "yyyy-MM-dd"),
          installment_number: i,
          status: "pending",
        });
      }

      const { error: repError } = await supabase
        .from("loan_repayments")
        .insert(repayments);

      if (repError) throw repError;

      // Create disbursement record
      const { error: disbError } = await supabase
        .from("disbursements")
        .insert({
          loan_id: loanApp.id,
          amount: loanDetails.principal,
          disbursement_method: "bank_transfer",
          status: "completed",
          disbursed_at: new Date().toISOString(),
        });

      if (disbError) throw disbError;

      return loanApp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Loan created successfully with repayment schedule");
      setIsAddLoanOpen(false);
      resetAddLoanForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create loan");
    },
  });

  const resetAddLoanForm = () => {
    setSelectedBorrowerId("");
    setSelectedProductId("");
    setLoanAmount("");
    setLoanTermMonths("");
    setLoanPurpose("");
    setEmploymentType("employed");
    setMonthlyIncome("");
  };

  // Update loan status mutation
  const updateLoanStatusMutation = useMutation({
    mutationFn: async ({ loanId, status }: { loanId: string; status: "active" | "completed" | "defaulted" }) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ status })
        .eq("id", loanId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Loan status updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update loan status");
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      active: { color: "bg-success/20 text-success border-success/30", icon: Activity },
      disbursed: { color: "bg-info/20 text-info border-info/30", icon: Wallet },
      completed: { color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
      defaulted: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.active;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  const calculateLoanProgress = (loan: Loan, repayments: Repayment[]) => {
    const paidRepayments = repayments.filter(r => r.status === "paid");
    const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
    const percentage = loan.total_repayment > 0 ? (totalPaid / loan.total_repayment) * 100 : 0;
    return {
      totalPaid,
      remaining: loan.total_repayment - totalPaid,
      percentage: Math.min(percentage, 100),
      paidCount: paidRepayments.length,
      totalCount: repayments.length,
    };
  };

  const getNextDueDate = (repayments: Repayment[]) => {
    const pendingRepayments = repayments
      .filter(r => r.status === "pending")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return pendingRepayments[0]?.due_date;
  };

  const getOverdueCount = (repayments: Repayment[]) => {
    const today = new Date();
    return repayments.filter(r => 
      r.status === "pending" && new Date(r.due_date) < today
    ).length;
  };

  const filteredLoans = loans?.filter((loan) => {
    const matchesSearch =
      loan.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: loans?.length || 0,
    active: loans?.filter((l) => l.status === "active").length || 0,
    completed: loans?.filter((l) => l.status === "completed").length || 0,
    defaulted: loans?.filter((l) => l.status === "defaulted").length || 0,
    totalPortfolio: loans?.reduce((sum, l) => sum + Number(l.total_repayment), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loan Management</h1>
            <p className="text-muted-foreground mt-1">
              Track and manage active loans and repayments
            </p>
          </div>
          <Button onClick={() => setIsAddLoanOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Loan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <CreditCard className="text-primary-foreground" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Loans</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Activity className="text-success" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <CheckCircle className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="text-destructive" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.defaulted}</p>
                <p className="text-sm text-muted-foreground">Defaulted</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">K{stats.totalPortfolio.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
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
                  placeholder="Search by name or email..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loans Table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
            <CardDescription>All disbursed and active loan accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLoans?.length === 0 ? (
              <div className="py-12 text-center">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No loans found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Disbursed loans will appear here"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Monthly Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans?.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <User className="text-primary" size={18} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{loan.full_name}</p>
                            <p className="text-sm text-muted-foreground">{loan.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-foreground">K{Number(loan.loan_amount).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total: K{Number(loan.total_repayment).toLocaleString()}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-foreground">{loan.loan_term_months} months</p>
                        <p className="text-xs text-muted-foreground">{loan.interest_rate}% rate</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">K{Number(loan.monthly_payment || 0).toLocaleString()}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(loan.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground capitalize">
                          {loan.loan_purpose?.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setIsDetailsOpen(true);
                            }}
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                          {loan.status === "active" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateLoanStatusMutation.mutate({ loanId: loan.id, status: "completed" })}
                              >
                                <CheckCircle size={14} className="mr-1" />
                                Complete
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => updateLoanStatusMutation.mutate({ loanId: loan.id, status: "defaulted" })}
                              >
                                <XCircle size={14} className="mr-1" />
                                Default
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Loan Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Loan Details</DialogTitle>
              <DialogDescription>
                Complete loan information and repayment schedule
              </DialogDescription>
            </DialogHeader>
            {selectedLoan && (
              <div className="space-y-6">
                {/* Loan Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Principal</p>
                    <p className="text-xl font-bold text-foreground">K{Number(selectedLoan.loan_amount).toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Repayment</p>
                    <p className="text-xl font-bold text-foreground">K{Number(selectedLoan.total_repayment).toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    <p className="text-xl font-bold text-foreground">K{Number(selectedLoan.monthly_payment || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Interest Rate</p>
                    <p className="text-xl font-bold text-foreground">{selectedLoan.interest_rate}%</p>
                  </div>
                </div>

                {/* Progress */}
                {loanRepayments && loanRepayments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-foreground">Repayment Progress</p>
                      <p className="text-sm text-muted-foreground">
                        {calculateLoanProgress(selectedLoan, loanRepayments).paidCount} of {calculateLoanProgress(selectedLoan, loanRepayments).totalCount} payments
                      </p>
                    </div>
                    <Progress value={calculateLoanProgress(selectedLoan, loanRepayments).percentage} className="h-3" />
                    <div className="flex justify-between text-sm">
                      <span className="text-success">Paid: K{calculateLoanProgress(selectedLoan, loanRepayments).totalPaid.toLocaleString()}</span>
                      <span className="text-muted-foreground">Remaining: K{calculateLoanProgress(selectedLoan, loanRepayments).remaining.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Next Due & Overdue Alert */}
                {loanRepayments && (
                  <div className="flex gap-4">
                    {getNextDueDate(loanRepayments) && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                        <Calendar className="text-info" size={18} />
                        <div>
                          <p className="text-xs text-muted-foreground">Next Due Date</p>
                          <p className="font-medium text-foreground">{format(new Date(getNextDueDate(loanRepayments)!), "MMM dd, yyyy")}</p>
                        </div>
                      </div>
                    )}
                    {getOverdueCount(loanRepayments) > 0 && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="text-destructive" size={18} />
                        <div>
                          <p className="text-xs text-muted-foreground">Overdue Payments</p>
                          <p className="font-medium text-destructive">{getOverdueCount(loanRepayments)} installments</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Repayment Schedule */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Repayment Schedule</h4>
                  {loanRepayments && loanRepayments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Paid Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loanRepayments.map((rep) => {
                          const isOverdue = rep.status === "pending" && new Date(rep.due_date) < new Date();
                          return (
                            <TableRow key={rep.id} className={isOverdue ? "bg-destructive/5" : ""}>
                              <TableCell>{rep.installment_number || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {format(new Date(rep.due_date), "MMM dd, yyyy")}
                                  {isOverdue && <AlertTriangle className="text-destructive" size={14} />}
                                </div>
                              </TableCell>
                              <TableCell>K{Number(rep.amount).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={
                                    rep.status === "paid" 
                                      ? "bg-success/20 text-success border-success/30" 
                                      : isOverdue 
                                        ? "bg-destructive/20 text-destructive border-destructive/30"
                                        : "bg-warning/20 text-warning border-warning/30"
                                  }
                                >
                                  {isOverdue ? "Overdue" : rep.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {rep.paid_date ? format(new Date(rep.paid_date), "MMM dd, yyyy") : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">
                      No repayment schedule generated yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Loan Dialog */}
        <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus size={20} />
                Add New Loan
              </DialogTitle>
              <DialogDescription>
                Create a loan for an existing borrower
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Borrower Selection */}
              <div className="space-y-2">
                <Label>Select Borrower *</Label>
                <Select value={selectedBorrowerId} onValueChange={setSelectedBorrowerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a borrower..." />
                  </SelectTrigger>
                  <SelectContent>
                    {borrowers?.map((borrower) => (
                      <SelectItem key={borrower.id} value={borrower.id}>
                        <div className="flex items-center gap-2">
                          <User size={14} />
                          {borrower.full_name || "Unknown"} - {borrower.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBorrower && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p><strong>Phone:</strong> {selectedBorrower.phone || "N/A"}</p>
                    <p><strong>NRC:</strong> {selectedBorrower.nrc_number || "N/A"}</p>
                    <p><strong>Address:</strong> {selectedBorrower.address || "N/A"}, {selectedBorrower.city || "N/A"}</p>
                  </div>
                )}
              </div>

              {/* Loan Product Selection */}
              <div className="space-y-2">
                <Label>Loan Product *</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a loan product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loanProducts?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {product.interest_rate}% interest
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p><strong>Interest Rate:</strong> {selectedProduct.interest_rate}%</p>
                    <p><strong>Amount Range:</strong> K{selectedProduct.min_amount.toLocaleString()} - K{selectedProduct.max_amount.toLocaleString()}</p>
                    <p><strong>Term Range:</strong> {selectedProduct.min_term_months} - {selectedProduct.max_term_months} months</p>
                    {selectedProduct.processing_fee_percent && (
                      <p><strong>Processing Fee:</strong> {selectedProduct.processing_fee_percent}%</p>
                    )}
                  </div>
                )}
              </div>

              {/* Loan Amount & Term */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Amount (K) *</Label>
                  <Input
                    type="number"
                    placeholder={selectedProduct ? `${selectedProduct.min_amount} - ${selectedProduct.max_amount}` : "Enter amount"}
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    min={selectedProduct?.min_amount}
                    max={selectedProduct?.max_amount}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Term (Months) *</Label>
                  <Input
                    type="number"
                    placeholder={selectedProduct ? `${selectedProduct.min_term_months} - ${selectedProduct.max_term_months}` : "Enter term"}
                    value={loanTermMonths}
                    onChange={(e) => setLoanTermMonths(e.target.value)}
                    min={selectedProduct?.min_term_months}
                    max={selectedProduct?.max_term_months}
                  />
                </div>
              </div>

              {/* Employment & Income */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employment Type *</Label>
                  <Select value={employmentType} onValueChange={setEmploymentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self_employed">Self Employed</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Income (K)</Label>
                  <Input
                    type="number"
                    placeholder="Enter monthly income"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                  />
                </div>
              </div>

              {/* Loan Purpose */}
              <div className="space-y-2">
                <Label>Loan Purpose *</Label>
                <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="home_improvement">Home Improvement</SelectItem>
                    <SelectItem value="debt_consolidation">Debt Consolidation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Summary */}
              {loanDetails && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                  <h4 className="font-semibold text-foreground">Loan Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Principal</p>
                      <p className="font-bold text-foreground">K{loanDetails.principal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest ({loanDetails.rate}%)</p>
                      <p className="font-bold text-foreground">K{loanDetails.interest.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Processing Fee</p>
                      <p className="font-bold text-foreground">K{loanDetails.processingFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Repayment</p>
                      <p className="font-bold text-primary">K{loanDetails.totalRepayment.toLocaleString()}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border">
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="text-xl font-bold text-primary">K{loanDetails.monthlyPayment.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddLoanOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createLoanMutation.mutate()}
                  disabled={!selectedBorrowerId || !selectedProductId || !loanAmount || !loanTermMonths || !loanPurpose || createLoanMutation.isPending}
                >
                  {createLoanMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="mr-2" />
                      Create Loan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminLoans;