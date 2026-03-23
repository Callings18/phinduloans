import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit } from "@/utils/auditLog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  User,
  Activity,
  Edit,
  MoreHorizontal,
  Download,
  Receipt,
  Phone,
  Building,
  Banknote,
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
import PaginationControls from "@/components/common/PaginationControls";
import { useAuth } from "@/hooks/useAuth";

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address: string | null;
  city: string | null;
  loan_amount: number;
  loan_term_months: number;
  term_unit: string;
  interest_rate: number;
  total_repayment: number;
  monthly_payment: number;
  monthly_income: number;
  status: string;
  created_at: string;
  loan_purpose: string;
  employment_type: string;
  employer_name: string | null;
  job_title: string | null;
  collateral_description: string | null;
  collateral_value: number | null;
  admin_notes: string | null;
  loan_product_id: string | null;
  assigned_to: string | null;
  contract_url: string | null;
  signed_contract_url: string | null;
  signed_contract_uploaded_at: string | null;
  borrower_signed: boolean | null;
  borrower_signed_at: string | null;
  admin_signed: boolean | null;
  admin_signed_at: string | null;
  contract_fully_signed_at: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  processing_fee_percent: number | null;
  enforcement_fee_percent?: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Activity },
  active: { label: "Active", color: "bg-info/20 text-info border-info/30", icon: Activity },
  completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
  defaulted: { label: "Defaulted", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

const AdminLoans = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Edit Loan Form State
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [editLoanAmount, setEditLoanAmount] = useState("");
  const [editLoanTermMonths, setEditLoanTermMonths] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editMonthlyIncome, setEditMonthlyIncome] = useState("");
  const [editLoanPurpose, setEditLoanPurpose] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [editEmploymentType, setEditEmploymentType] = useState("");

  // Quick Payment State
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPaymentLoan, setQuickPaymentLoan] = useState<Loan | null>(null);
  const [quickPaymentData, setQuickPaymentData] = useState({
    payment_method: "mobile_money",
    transaction_reference: "",
  });
  const [nextRepayment, setNextRepayment] = useState<any>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();

  // Fetch only post-disbursement loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ["admin-portfolio-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .in("status", ["active", "disbursed", "completed", "defaulted"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loan[];
    },
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  // Fetch next due dates for active loans
  const { data: loanDueDates } = useQuery({
    queryKey: ["loan-due-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("loan_id, due_date")
        .eq("status", "pending")
        .order("due_date", { ascending: true });

      if (error) throw error;
      const dueDateMap: Record<string, string> = {};
      data.forEach((r) => {
        if (!dueDateMap[r.loan_id]) dueDateMap[r.loan_id] = r.due_date;
      });
      return dueDateMap;
    },
  });

  // Fetch loan products for fee calculations
  const { data: loanProducts } = useQuery({
    queryKey: ["admin-loan-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name, interest_rate, processing_fee_percent, enforcement_fee_percent")
        .eq("is_active", true);
      if (error) throw error;
      return data as LoanProduct[];
    },
  });

  // Move to defaulted mutation
  const moveToDefaultedMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: "defaulted" as any })
        .eq("id", loanId);
      if (error) throw error;
      await logAudit({
        action: "MOVE_TO_DEFAULTED",
        entity_type: "loan_application",
        entity_id: loanId,
        module: "loans",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      toast.success("Loan moved to defaulted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update status"),
  });

  // Edit loan mutation
  const editLoanMutation = useMutation({
    mutationFn: async () => {
      if (!editingLoan) throw new Error("No loan selected");
      const principal = Number(editLoanAmount);
      const rate = Number(editInterestRate);
      const termValue = Number(editLoanTermMonths);
      const termUnit = (editingLoan.term_unit as any) || 'months';

      // Fetch product settings for accurate calculation
      let productSettings: any = { interest_rate: rate, interest_period: 'monthly', interest_type: 'flat' };
      if (editingLoan.loan_product_id) {
        const { data: product } = await supabase
          .from("loan_products")
          .select("interest_rate, interest_period, interest_type, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent, term_unit")
          .eq("id", editingLoan.loan_product_id)
          .single();
        if (product) {
          productSettings = { ...product, interest_rate: rate };
        }
      }

      // Use the unified calculateLoan function for accurate results
      const { calculateLoan } = await import("@/utils/loanCalculations");
      const calc = calculateLoan(principal, termValue, productSettings, termUnit);

      const { error } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: principal,
          loan_term_months: termValue,
          interest_rate: rate,
          monthly_payment: calc.monthlyPayment,
          total_repayment: calc.totalRepayment,
          monthly_income: Number(editMonthlyIncome) || editingLoan.monthly_income,
          loan_purpose: editLoanPurpose,
          employment_type: editEmploymentType as "employed" | "self_employed" | "contract" | "other",
          admin_notes: editAdminNotes || null,
        })
        .eq("id", editingLoan.id);
      if (error) throw error;

      await logAudit({
        action: "LOAN_EDIT",
        entity_type: "loan_application",
        entity_id: editingLoan.id,
        module: "loans",
        new_values: { loan_amount: principal, interest_rate: rate, loan_term_months: termValue },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      toast.success("Loan updated successfully");
      setIsEditLoanOpen(false);
      setEditingLoan(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to update loan"),
  });

  // Quick payment mutation
  const quickPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!nextRepayment || !quickPaymentLoan) throw new Error("No repayment selected");
      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          paid_date: new Date().toISOString(),
          payment_method: quickPaymentData.payment_method,
          transaction_reference: quickPaymentData.transaction_reference || `PAY-${Date.now()}`,
        })
        .eq("id", nextRepayment.id);
      if (error) throw error;

      // Check if all repayments are paid
      const { data: remainingPending } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", quickPaymentLoan.id)
        .eq("status", "pending");

      if (remainingPending && remainingPending.length === 0) {
        await supabase
          .from("loan_applications")
          .update({ status: "completed" })
          .eq("id", quickPaymentLoan.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-due-dates"] });
      toast.success("Payment recorded successfully");
      setIsQuickPaymentOpen(false);
      setQuickPaymentLoan(null);
      setNextRepayment(null);
    },
    onError: (error: any) => toast.error(error.message || "Failed to record payment"),
  });

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

  const openQuickPayment = async (loan: Loan) => {
    setQuickPaymentLoan(loan);
    setQuickPaymentData({ payment_method: "mobile_money", transaction_reference: "" });
    const { data: repayment } = await supabase
      .from("loan_repayments")
      .select("*")
      .eq("loan_id", loan.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    setNextRepayment(repayment);
    setIsQuickPaymentOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, color: "bg-muted text-muted-foreground", icon: Activity };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} capitalize border`}>
        <Icon size={12} className="mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Filter loans based on active tab
  const getFilteredLoans = () => {
    let filtered = loans || [];
    if (activeTab === "active") {
      filtered = filtered.filter(l => ["active", "disbursed"].includes(l.status));
    } else if (activeTab === "completed") {
      filtered = filtered.filter(l => l.status === "completed");
    } else if (activeTab === "defaulted") {
      filtered = filtered.filter(l => l.status === "defaulted");
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(l =>
        l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.nrc_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  };

  const filteredLoans = getFilteredLoans();

  // Paginate filtered loans
  const paginatedLoans = filteredLoans.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [activeTab, statusFilter, searchTerm]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-loans-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const stats = {
    total: loans?.length || 0,
    active: loans?.filter(l => ["active", "disbursed"].includes(l.status)).length || 0,
    completed: loans?.filter(l => l.status === "completed").length || 0,
    defaulted: loans?.filter(l => l.status === "defaulted").length || 0,
    totalPortfolio: loans?.filter(l => ["active", "disbursed"].includes(l.status)).reduce((sum, l) => sum + Number(l.total_repayment), 0) || 0,
  };

  const getStatusOptions = () => {
    if (activeTab === "active") {
      return [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "disbursed", label: "Disbursed" },
      ];
    }
    return [{ value: "all", label: "All" }];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Portfolio</h1>
          <p className="text-muted-foreground mt-1">
            Monitor active, completed, and defaulted loans
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <CreditCard className="text-primary-foreground" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Loans</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                <Activity className="text-info" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <CheckCircle className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                <XCircle className="text-destructive" size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{stats.defaulted}</p>
                <p className="text-xs text-muted-foreground">Defaulted</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setStatusFilter("all"); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active Loans ({stats.active})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
            <TabsTrigger value="defaulted">Defaulted ({stats.defaulted})</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <Card className="border-border/50 bg-card/50 mt-4">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search by name, email, or NRC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Loans Table */}
          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : paginatedLoans.length > 0 ? (
              <>
                <Card className="border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLoans.map((loan) => {
                        const dueDate = loanDueDates?.[loan.id];
                        const isOverdue = dueDate && new Date(dueDate) < new Date(new Date().toDateString());
                        const product = loanProducts?.find(p => p.id === loan.loan_product_id);
                        const loanPrincipal = Number(loan.loan_amount);
                        const processingFee = product?.processing_fee_percent ? (loanPrincipal * product.processing_fee_percent / 100) : 0;
                        const enforcementFee = product?.enforcement_fee_percent ? (loanPrincipal * product.enforcement_fee_percent / 100) : 0;
                        const insuranceFee = (product as any)?.insurance_percent ? (loanPrincipal * (product as any).insurance_percent / 100) : 0;
                        const platformFee = (product as any)?.platform_fee_percent ? (loanPrincipal * (product as any).platform_fee_percent / 100) : 0;
                        const vatableAmount = processingFee + enforcementFee + platformFee;
                        const vatAmount = (product as any)?.vat_percent ? (vatableAmount * (product as any).vat_percent / 100) : 0;
                        const disbursedAmount = loanPrincipal - processingFee - enforcementFee - insuranceFee - platformFee - vatAmount;

                        return (
                          <TableRow key={loan.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                  <User size={18} className="text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{loan.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{loan.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">K{Number(loan.loan_amount).toLocaleString()}</p>
                                {(processingFee > 0 || enforcementFee > 0 || insuranceFee > 0 || platformFee > 0 || vatAmount > 0) && (
                                  <p className="text-xs text-success">Disbursed: K{disbursedAmount.toLocaleString()}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{loan.loan_term_months} {loan.term_unit || 'months'}</TableCell>
                            <TableCell>{getStatusBadge(loan.status)}</TableCell>
                            <TableCell>
                              <p className="text-sm">{format(new Date(loan.created_at), "MMM dd, yyyy")}</p>
                            </TableCell>
                            <TableCell>
                              {dueDate ? (
                                <p className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
                                  {format(new Date(dueDate), "MMM dd, yyyy")}
                                  {isOverdue && <span className="text-xs block text-destructive">Overdue</span>}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">-</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    Actions
                                    <MoreHorizontal size={14} className="ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedLoan(loan);
                                    setIsDetailsOpen(true);
                                  }}>
                                    <Eye size={14} className="mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  {can('loans', 'edit') && (
                                    <DropdownMenuItem onClick={() => openEditDialog(loan)}>
                                      <Edit size={14} className="mr-2" />
                                      Edit Loan
                                    </DropdownMenuItem>
                                  )}
                                  {["active", "disbursed"].includes(loan.status) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openQuickPayment(loan)}>
                                        <Receipt size={14} className="mr-2" />
                                        Record Payment
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedLoan(loan);
                                        setIsDetailsOpen(true);
                                      }}>
                                        <Download size={14} className="mr-2" />
                                        View Schedule
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {["active", "disbursed"].includes(loan.status) && can('loans', 'edit') && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          if (confirm(`Are you sure you want to move ${loan.full_name}'s loan to Defaulted?`)) {
                                            moveToDefaultedMutation.mutate(loan.id);
                                          }
                                        }}
                                      >
                                        <XCircle size={14} className="mr-2" />
                                        Move to Defaulted
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={filteredLoans.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                />
              </>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No loans found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Loan Details Modal */}
      <LoanDetailsModal
        loan={selectedLoan}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedLoan(null);
        }}
      />

      {/* Edit Loan Dialog */}
      <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loan</DialogTitle>
            <DialogDescription>Update loan details for {editingLoan?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loan Amount (K)</Label>
                <Input type="number" value={editLoanAmount} onChange={(e) => setEditLoanAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Term ({editingLoan?.term_unit || 'months'})</Label>
                <Input type="number" value={editLoanTermMonths} onChange={(e) => setEditLoanTermMonths(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate (%)</Label>
                <Input type="number" value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Income (K)</Label>
                <Input type="number" value={editMonthlyIncome} onChange={(e) => setEditMonthlyIncome(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={editEmploymentType} onValueChange={setEditEmploymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input value={editLoanPurpose} onChange={(e) => setEditLoanPurpose(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea value={editAdminNotes} onChange={(e) => setEditAdminNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditLoanOpen(false)}>Cancel</Button>
            {can('loans', 'edit') && (
              <Button onClick={() => editLoanMutation.mutate()} disabled={editLoanMutation.isPending}>
                {editLoanMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Payment Dialog */}
      <Dialog open={isQuickPaymentOpen} onOpenChange={setIsQuickPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={20} className="text-primary" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Quick payment for {quickPaymentLoan?.full_name}
            </DialogDescription>
          </DialogHeader>

          {nextRepayment ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Installment</span>
                  <span className="font-medium">#{nextRepayment.installment_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="font-medium">{format(new Date(nextRepayment.due_date), "MMM dd, yyyy")}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="font-semibold">Amount Due</span>
                  <span className="text-xl font-bold text-primary">K{Number(nextRepayment.amount).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={quickPaymentData.payment_method}
                    onValueChange={(v) => setQuickPaymentData({ ...quickPaymentData, payment_method: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">
                        <div className="flex items-center gap-2"><Phone size={14} /> Mobile Money</div>
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        <div className="flex items-center gap-2"><Building size={14} /> Bank Transfer</div>
                      </SelectItem>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2"><Banknote size={14} /> Cash</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transaction Reference (Optional)</Label>
                  <Input
                    value={quickPaymentData.transaction_reference}
                    onChange={(e) => setQuickPaymentData({ ...quickPaymentData, transaction_reference: e.target.value })}
                    placeholder="Enter reference number"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsQuickPaymentOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => quickPaymentMutation.mutate()}
                  disabled={quickPaymentMutation.isPending}
                  className="gradient-primary"
                >
                  {quickPaymentMutation.isPending ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : (
                    <CheckCircle size={16} className="mr-2" />
                  )}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending repayments found for this loan</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setIsQuickPaymentOpen(false);
                  setSelectedLoan(quickPaymentLoan);
                  setIsDetailsOpen(true);
                }}
              >
                View Loan Details
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminLoans;
