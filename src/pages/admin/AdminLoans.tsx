import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { format, addMonths, parseISO } from "date-fns";
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Eye,
  User,
  Wallet,
  TrendingUp,
  Activity,
  Plus,
  UserPlus,
  Edit,
  Calendar,
  CalendarPlus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoanDetailsModal from "@/components/admin/LoanDetailsModal";
import { useAuth } from "@/hooks/useAuth";

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
  monthly_income: number;
  employer_name: string | null;
  job_title: string | null;
  collateral_description: string | null;
  collateral_value: number | null;
  admin_notes: string | null;
  loan_product_id: string | null;
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
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  
  // Add Loan Form State
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [loanTermMonths, setLoanTermMonths] = useState<string>("");
  const [loanPurpose, setLoanPurpose] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("employed");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [disbursementDate, setDisbursementDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [firstRepaymentDate, setFirstRepaymentDate] = useState<string>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [createWithDisbursement, setCreateWithDisbursement] = useState<boolean>(false);

  // Edit Loan Form State
  const [editLoanAmount, setEditLoanAmount] = useState<string>("");
  const [editLoanTermMonths, setEditLoanTermMonths] = useState<string>("");
  const [editInterestRate, setEditInterestRate] = useState<string>("");
  const [editMonthlyIncome, setEditMonthlyIncome] = useState<string>("");
  const [editLoanPurpose, setEditLoanPurpose] = useState<string>("");
  const [editAdminNotes, setEditAdminNotes] = useState<string>("");
  const [editEmploymentType, setEditEmploymentType] = useState<string>("");

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch active/disbursed loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ["admin-active-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .in("status", ["active", "disbursed", "completed", "defaulted", "pending", "approved"])
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

  // Create loan mutation - now creates with PENDING status by default
  const createLoanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower || !selectedProduct || !loanDetails) {
        throw new Error("Please fill in all required fields");
      }

      // Create loan application with PENDING status (proper flow)
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
          admin_notes: adminNotes || null,
          status: createWithDisbursement ? "active" : "pending", // Start with pending unless quick disbursement
        })
        .select()
        .single();

      if (loanError) throw loanError;

      // If creating with immediate disbursement (for backdating or quick loans)
      if (createWithDisbursement) {
        // Create disbursement record
        const { error: disbError } = await supabase
          .from("disbursements")
          .insert({
            loan_id: loanApp.id,
            amount: loanDetails.principal,
            disbursement_method: "bank_transfer",
            status: "completed",
            disbursed_at: new Date(disbursementDate).toISOString(),
            transaction_reference: `ADMIN-${Date.now()}`,
          });

        if (disbError) throw disbError;

        // Generate repayment schedule with custom first repayment date
        const repayments = [];
        const firstRepayment = parseISO(firstRepaymentDate);
        for (let i = 0; i < Number(loanTermMonths); i++) {
          repayments.push({
            loan_id: loanApp.id,
            user_id: selectedBorrowerId,
            amount: loanDetails.monthlyPayment,
            due_date: format(addMonths(firstRepayment, i), "yyyy-MM-dd"),
            installment_number: i + 1,
            status: "pending",
          });
        }

        const { error: repError } = await supabase
          .from("loan_repayments")
          .insert(repayments);

        if (repError) throw repError;
      }

      return loanApp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast.success(createWithDisbursement 
        ? "Loan created and disbursed with repayment schedule" 
        : "Loan application created - proceed to review and approval");
      setIsAddLoanOpen(false);
      resetAddLoanForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create loan");
    },
  });

  // Edit loan mutation
  const editLoanMutation = useMutation({
    mutationFn: async () => {
      if (!editingLoan) throw new Error("No loan selected");

      const principal = Number(editLoanAmount);
      const rate = Number(editInterestRate);
      const months = Number(editLoanTermMonths);
      
      const interest = principal * (rate / 100) * months;
      const totalRepayment = principal + interest;
      const monthlyPayment = totalRepayment / months;

      const { error } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: principal,
          loan_term_months: months,
          interest_rate: rate,
          monthly_payment: monthlyPayment,
          total_repayment: totalRepayment,
          monthly_income: Number(editMonthlyIncome) || editingLoan.monthly_income,
          loan_purpose: editLoanPurpose,
          employment_type: editEmploymentType as "employed" | "self_employed" | "contract" | "other",
          admin_notes: editAdminNotes || null,
        })
        .eq("id", editingLoan.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Loan updated successfully");
      setIsEditLoanOpen(false);
      setEditingLoan(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update loan");
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
    setAdminNotes("");
    setDisbursementDate(format(new Date(), "yyyy-MM-dd"));
    setFirstRepaymentDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setCreateWithDisbursement(false);
  };

  const openEditDialog = (loan: Loan) => {
    setEditingLoan(loan);
    setEditLoanAmount(loan.loan_amount.toString());
    setEditLoanTermMonths(loan.loan_term_months.toString());
    setEditInterestRate(loan.interest_rate.toString());
    setEditMonthlyIncome(loan.monthly_income?.toString() || "");
    setEditLoanPurpose(loan.loan_purpose);
    setEditEmploymentType(loan.employment_type);
    setEditAdminNotes(loan.admin_notes || "");
    setIsEditLoanOpen(true);
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
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: AlertTriangle },
      approved: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
      active: { color: "bg-info/20 text-info border-info/30", icon: Activity },
      disbursed: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Wallet },
      completed: { color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
      defaulted: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
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
    pending: loans?.filter((l) => l.status === "pending").length || 0,
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
              Create, track and manage loans
            </p>
          </div>
          <Button onClick={() => setIsAddLoanOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Loan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="text-warning" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
                <Activity className="text-info" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
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
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <XCircle className="text-destructive" size={24} />
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
                <p className="text-sm text-muted-foreground">Portfolio</p>
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
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
            <CardTitle>All Loans</CardTitle>
            <CardDescription>Manage loan applications and active loans</CardDescription>
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
                    : "Create your first loan to get started"}
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
                    <TableHead>Created</TableHead>
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
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(loan.created_at), "MMM dd, yyyy")}
                        </p>
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
                          {["pending", "approved"].includes(loan.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(loan)}
                            >
                              <Edit size={14} className="mr-1" />
                              Edit
                            </Button>
                          )}
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

        {/* Loan Details Modal */}
        <LoanDetailsModal 
          loan={selectedLoan} 
          open={isDetailsOpen} 
          onOpenChange={setIsDetailsOpen} 
        />

        {/* Add Loan Dialog */}
        <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus size={20} />
                Add New Loan
              </DialogTitle>
              <DialogDescription>
                Create a loan application for an existing borrower. The loan will go through the approval workflow unless you enable quick disbursement.
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

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Add any internal notes about this loan..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Quick Disbursement Option */}
              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="quickDisburse"
                    checked={createWithDisbursement}
                    onChange={(e) => setCreateWithDisbursement(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="quickDisburse" className="cursor-pointer">
                    <span className="font-medium">Quick Disbursement</span>
                    <span className="text-muted-foreground text-sm block">
                      Skip approval workflow and immediately create active loan with repayment schedule (for backdating or walk-in customers)
                    </span>
                  </Label>
                </div>

                {createWithDisbursement && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar size={14} />
                        Disbursement Date
                      </Label>
                      <Input
                        type="date"
                        value={disbursementDate}
                        onChange={(e) => setDisbursementDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarPlus size={14} />
                        First Repayment Date
                      </Label>
                      <Input
                        type="date"
                        value={firstRepaymentDate}
                        onChange={(e) => setFirstRepaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
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
                      {createWithDisbursement ? "Create & Disburse" : "Create Application"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Loan Dialog */}
        <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit size={20} />
                Edit Loan
              </DialogTitle>
              <DialogDescription>
                Update loan details for {editingLoan?.full_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Amount (K) *</Label>
                  <Input
                    type="number"
                    value={editLoanAmount}
                    onChange={(e) => setEditLoanAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Term (Months) *</Label>
                  <Input
                    type="number"
                    value={editLoanTermMonths}
                    onChange={(e) => setEditLoanTermMonths(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interest Rate (%) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editInterestRate}
                    onChange={(e) => setEditInterestRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Income (K)</Label>
                  <Input
                    type="number"
                    value={editMonthlyIncome}
                    onChange={(e) => setEditMonthlyIncome(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={editEmploymentType} onValueChange={setEditEmploymentType}>
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
                <Label>Loan Purpose</Label>
                <Select value={editLoanPurpose} onValueChange={setEditLoanPurpose}>
                  <SelectTrigger>
                    <SelectValue />
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

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Calculated Summary */}
              {editLoanAmount && editLoanTermMonths && editInterestRate && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p><strong>Monthly Payment:</strong> K{(
                    (Number(editLoanAmount) * (1 + (Number(editInterestRate) / 100) * Number(editLoanTermMonths))) / Number(editLoanTermMonths)
                  ).toLocaleString()}</p>
                  <p><strong>Total Repayment:</strong> K{(
                    Number(editLoanAmount) * (1 + (Number(editInterestRate) / 100) * Number(editLoanTermMonths))
                  ).toLocaleString()}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditLoanOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => editLoanMutation.mutate()}
                  disabled={!editLoanAmount || !editLoanTermMonths || !editInterestRate || editLoanMutation.isPending}
                >
                  {editLoanMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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
