import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  CreditCard,
  Briefcase,
  Plus,
  Trash2,
  FileText,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Printer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateLoanContract } from "@/utils/generateLoanContract";

const statusConfig = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  under_review: { label: "Under Review", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  disbursed: { label: "Disbursed", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  defaulted: { label: "Defaulted", color: "bg-red-600/20 text-red-500 border-red-600/30" },
};

const AdminApplications = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Add loan form state
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
  const [newLoan, setNewLoan] = useState({
    employer_name: "",
    job_title: "",
    employment_type: "employed" as const,
    employment_duration: "",
    monthly_income: "",
    loan_amount: "",
    loan_term_months: "",
    loan_purpose: "",
    interest_rate: "15",
    collateral_description: "",
    collateral_value: "",
    admin_notes: "",
  });

  // Disbursement form state
  const [disbursement, setDisbursement] = useState({
    disbursement_method: "bank_transfer",
    account_number: "",
    mobile_money_number: "",
    transaction_reference: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: applications, isLoading } = useQuery({
    queryKey: ['admin-applications', statusFilter],
    queryFn: async () => {
      let query = supabase.from('loan_applications').select('*').order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: loanProducts } = useQuery({
    queryKey: ['loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('loan_products').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch borrowers (profiles)
  const { data: borrowers } = useQuery({
    queryKey: ['borrowers-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async (data: { borrowerId: string; loanData: typeof newLoan }) => {
      const borrower = borrowers?.find(b => b.id === data.borrowerId);
      if (!borrower) throw new Error('Borrower not found');

      const monthlyIncome = parseFloat(data.loanData.monthly_income);
      const loanAmount = parseFloat(data.loanData.loan_amount);
      const interestRate = parseFloat(data.loanData.interest_rate);
      const termMonths = parseInt(data.loanData.loan_term_months);
      
      const totalRepayment = loanAmount * (1 + (interestRate / 100) * (termMonths / 12));
      const monthlyPayment = totalRepayment / termMonths;

      const { error } = await supabase.from('loan_applications').insert({
        user_id: borrower.id,
        full_name: borrower.full_name || borrower.email,
        email: borrower.email,
        phone: borrower.phone || '',
        nrc_number: borrower.nrc_number || '',
        address: borrower.address || null,
        city: borrower.city || null,
        employer_name: data.loanData.employer_name || null,
        job_title: data.loanData.job_title || null,
        employment_type: data.loanData.employment_type,
        employment_duration: data.loanData.employment_duration || null,
        monthly_income: monthlyIncome,
        loan_amount: loanAmount,
        loan_term_months: termMonths,
        loan_purpose: data.loanData.loan_purpose,
        interest_rate: interestRate,
        monthly_payment: monthlyPayment,
        total_repayment: totalRepayment,
        collateral_description: data.loanData.collateral_description || null,
        collateral_value: data.loanData.collateral_value ? parseFloat(data.loanData.collateral_value) : null,
        admin_notes: data.loanData.admin_notes || null,
        status: 'pending',
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      toast({ title: "Loan application created successfully" });
      setIsAddOpen(false);
      resetNewLoanForm();
    },
    onError: (error) => {
      toast({ title: "Error creating loan", description: error.message, variant: "destructive" });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updateData: any = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      
      if (reason) {
        updateData.rejection_reason = reason;
      }

      const { error } = await supabase
        .from('loan_applications')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      toast({ title: "Application updated successfully" });
      setIsViewOpen(false);
      setRejectionReason("");
    },
    onError: (error) => {
      toast({ title: "Error updating application", description: error.message, variant: "destructive" });
    },
  });

  // Disburse mutation
  const disburseMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create disbursement record
      const { error: disbError } = await supabase.from('disbursements').insert({
        loan_id: selectedApp.id,
        amount: selectedApp.loan_amount,
        disbursement_method: data.disbursement_method,
        account_number: data.account_number || null,
        mobile_money_number: data.mobile_money_number || null,
        transaction_reference: data.transaction_reference || null,
        status: 'completed',
        disbursed_at: new Date().toISOString(),
      });
      
      if (disbError) throw disbError;

      // Update loan status to disbursed
      const { error: loanError } = await supabase
        .from('loan_applications')
        .update({ 
          status: 'disbursed',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApp.id);
      
      if (loanError) throw loanError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      queryClient.invalidateQueries({ queryKey: ['disbursements'] });
      toast({ title: "Loan disbursed successfully" });
      setIsDisburseOpen(false);
      setIsViewOpen(false);
      resetDisbursementForm();
    },
    onError: (error) => {
      toast({ title: "Error disbursing loan", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loan_applications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      toast({ title: "Application deleted successfully" });
      setIsDeleteOpen(false);
      setIsViewOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error deleting application", description: error.message, variant: "destructive" });
    },
  });

  const resetNewLoanForm = () => {
    setSelectedBorrowerId("");
    setNewLoan({
      employer_name: "",
      job_title: "",
      employment_type: "employed",
      employment_duration: "",
      monthly_income: "",
      loan_amount: "",
      loan_term_months: "",
      loan_purpose: "",
      interest_rate: "15",
      collateral_description: "",
      collateral_value: "",
      admin_notes: "",
    });
  };

  const resetDisbursementForm = () => {
    setDisbursement({
      disbursement_method: "bank_transfer",
      account_number: "",
      mobile_money_number: "",
      transaction_reference: "",
    });
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ id: selectedApp.id, status: 'approved' });
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason) {
      toast({ title: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ 
      id: selectedApp.id, 
      status: 'rejected',
      reason: rejectionReason,
    });
    setIsProcessing(false);
  };

  const handleCreateLoan = () => {
    if (!selectedBorrowerId) {
      toast({ title: "Please select a borrower", variant: "destructive" });
      return;
    }
    if (!newLoan.loan_amount || !newLoan.loan_term_months || !newLoan.loan_purpose || !newLoan.monthly_income) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createLoanMutation.mutate({ borrowerId: selectedBorrowerId, loanData: newLoan });
  };

  const handleDisburse = () => {
    if (!disbursement.transaction_reference) {
      toast({ title: "Please enter a transaction reference", variant: "destructive" });
      return;
    }
    if (disbursement.disbursement_method === 'bank_transfer' && !disbursement.account_number) {
      toast({ title: "Please enter account number for bank transfer", variant: "destructive" });
      return;
    }
    if (disbursement.disbursement_method === 'mobile_money' && !disbursement.mobile_money_number) {
      toast({ title: "Please enter mobile money number", variant: "destructive" });
      return;
    }
    disburseMutation.mutate(disbursement);
  };

  const filteredApps = applications?.filter(app =>
    app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.nrc_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Loan Applications</h1>
            <p className="text-muted-foreground mt-1">Review, add, and manage loan applications</p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2">
            <Plus size={16} />
            Add Loan
          </Button>
        </div>

        {/* Filters */}
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name, email, or NRC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter size={16} className="mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredApps && filteredApps.length > 0 ? (
          <div className="space-y-4">
            {filteredApps.map((app) => {
              const config = statusConfig[app.status as keyof typeof statusConfig];
              
              return (
                <Card key={app.id} className="glass border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                          <User className="text-primary" size={24} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-foreground">{app.full_name}</h4>
                          <p className="text-muted-foreground text-sm">{app.email}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CreditCard size={12} />
                              K{Number(app.loan_amount).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase size={12} />
                              {app.employer_name || 'N/A'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={`${config?.color} border`}>
                          {config?.label}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedApp(app);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye size={16} className="mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="glass border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Loan Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add New Loan Application</DialogTitle>
            <DialogDescription>Create a new loan application manually</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="borrower" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="borrower">Borrower</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="loan">Loan Details</TabsTrigger>
              <TabsTrigger value="collateral">Collateral</TabsTrigger>
            </TabsList>

            <TabsContent value="borrower" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Borrower *</Label>
                  <Select value={selectedBorrowerId} onValueChange={setSelectedBorrowerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a borrower from the system" />
                    </SelectTrigger>
                    <SelectContent>
                      {borrowers?.map((borrower) => (
                        <SelectItem key={borrower.id} value={borrower.id}>
                          {borrower.full_name || borrower.email} - {borrower.nrc_number || 'No NRC'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {borrowers?.length === 0 && (
                    <p className="text-sm text-muted-foreground">No borrowers found. Add borrowers first.</p>
                  )}
                </div>

                {selectedBorrowerId && (() => {
                  const borrower = borrowers?.find(b => b.id === selectedBorrowerId);
                  if (!borrower) return null;
                  return (
                    <Card className="bg-secondary/30 border-border/50">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-3 text-foreground">Borrower Details</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Full Name</p>
                            <p className="text-foreground font-medium">{borrower.full_name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Email</p>
                            <p className="text-foreground font-medium">{borrower.email}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p className="text-foreground font-medium">{borrower.phone || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">NRC Number</p>
                            <p className="text-foreground font-medium">{borrower.nrc_number || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">City</p>
                            <p className="text-foreground font-medium">{borrower.city || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Address</p>
                            <p className="text-foreground font-medium">{borrower.address || 'N/A'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employer Name</Label>
                  <Input
                    value={newLoan.employer_name}
                    onChange={(e) => setNewLoan({ ...newLoan, employer_name: e.target.value })}
                    placeholder="ABC Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    value={newLoan.job_title}
                    onChange={(e) => setNewLoan({ ...newLoan, job_title: e.target.value })}
                    placeholder="Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employment Type *</Label>
                  <Select
                    value={newLoan.employment_type}
                    onValueChange={(v: any) => setNewLoan({ ...newLoan, employment_type: v })}
                  >
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
                  <Label>Employment Duration</Label>
                  <Input
                    value={newLoan.employment_duration}
                    onChange={(e) => setNewLoan({ ...newLoan, employment_duration: e.target.value })}
                    placeholder="2 years"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Income (K) *</Label>
                  <Input
                    type="number"
                    value={newLoan.monthly_income}
                    onChange={(e) => setNewLoan({ ...newLoan, monthly_income: e.target.value })}
                    placeholder="5000"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="loan" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Amount (K) *</Label>
                  <Input
                    type="number"
                    value={newLoan.loan_amount}
                    onChange={(e) => setNewLoan({ ...newLoan, loan_amount: e.target.value })}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loan Term (months) *</Label>
                  <Input
                    type="number"
                    value={newLoan.loan_term_months}
                    onChange={(e) => setNewLoan({ ...newLoan, loan_term_months: e.target.value })}
                    placeholder="12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%) *</Label>
                  <Input
                    type="number"
                    value={newLoan.interest_rate}
                    onChange={(e) => setNewLoan({ ...newLoan, interest_rate: e.target.value })}
                    placeholder="15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loan Purpose *</Label>
                  <Select
                    value={newLoan.loan_purpose}
                    onValueChange={(v) => setNewLoan({ ...newLoan, loan_purpose: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="medical">Medical</SelectItem>
                      <SelectItem value="home_improvement">Home Improvement</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newLoan.loan_amount && newLoan.loan_term_months && newLoan.interest_rate && (
                <Card className="bg-secondary/50 border-border/50">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2 text-foreground">Loan Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Repayment</p>
                        <p className="font-medium text-foreground">
                          K{(parseFloat(newLoan.loan_amount) * (1 + (parseFloat(newLoan.interest_rate) / 100) * (parseInt(newLoan.loan_term_months) / 12))).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Payment</p>
                        <p className="font-medium text-foreground">
                          K{((parseFloat(newLoan.loan_amount) * (1 + (parseFloat(newLoan.interest_rate) / 100) * (parseInt(newLoan.loan_term_months) / 12))) / parseInt(newLoan.loan_term_months)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Interest</p>
                        <p className="font-medium text-foreground">
                          K{(parseFloat(newLoan.loan_amount) * (parseFloat(newLoan.interest_rate) / 100) * (parseInt(newLoan.loan_term_months) / 12)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="collateral" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Collateral Description</Label>
                  <Textarea
                    value={newLoan.collateral_description}
                    onChange={(e) => setNewLoan({ ...newLoan, collateral_description: e.target.value })}
                    placeholder="Describe the collateral (e.g., Vehicle, Property, etc.)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Collateral Value (K)</Label>
                  <Input
                    type="number"
                    value={newLoan.collateral_value}
                    onChange={(e) => setNewLoan({ ...newLoan, collateral_value: e.target.value })}
                    placeholder="50000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  value={newLoan.admin_notes}
                  onChange={(e) => setNewLoan({ ...newLoan, admin_notes: e.target.value })}
                  placeholder="Internal notes about this application..."
                  rows={4}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLoan} disabled={createLoanMutation.isPending}>
              <Plus size={16} className="mr-1" />
              Create Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Detail Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              Application Details
              {selectedApp && (
                <Badge className={`${statusConfig[selectedApp.status as keyof typeof statusConfig]?.color} border ml-2`}>
                  {statusConfig[selectedApp.status as keyof typeof statusConfig]?.label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Review and manage loan application</DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <User size={18} />
                    Personal Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Full Name</p>
                      <p className="text-foreground font-medium">{selectedApp.full_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="text-foreground font-medium">{selectedApp.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="text-foreground font-medium">{selectedApp.phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">NRC Number</p>
                      <p className="text-foreground font-medium">{selectedApp.nrc_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Address</p>
                      <p className="text-foreground font-medium">{selectedApp.address || 'N/A'}, {selectedApp.city || ''}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="text-foreground font-medium">{selectedApp.date_of_birth ? new Date(selectedApp.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Employment Info */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Briefcase size={18} />
                    Employment Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Employer</p>
                      <p className="text-foreground font-medium">{selectedApp.employer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Job Title</p>
                      <p className="text-foreground font-medium">{selectedApp.job_title || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Income</p>
                      <p className="text-foreground font-medium">K{Number(selectedApp.monthly_income).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Employment Type</p>
                      <p className="text-foreground font-medium capitalize">{selectedApp.employment_type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                {/* Loan Details */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <CreditCard size={18} />
                    Loan Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Loan Amount</p>
                      <p className="text-foreground font-medium text-lg">K{Number(selectedApp.loan_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Term</p>
                      <p className="text-foreground font-medium">{selectedApp.loan_term_months} months</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest Rate</p>
                      <p className="text-foreground font-medium">{selectedApp.interest_rate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="text-foreground font-medium">K{Number(selectedApp.monthly_payment || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Repayment</p>
                      <p className="text-foreground font-medium">K{Number(selectedApp.total_repayment || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purpose</p>
                      <p className="text-foreground font-medium capitalize">{selectedApp.loan_purpose?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                {/* Collateral */}
                {(selectedApp.collateral_description || selectedApp.collateral_value) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck size={18} />
                      Collateral
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Description</p>
                        <p className="text-foreground font-medium">{selectedApp.collateral_description || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Value</p>
                        <p className="text-foreground font-medium">K{Number(selectedApp.collateral_value || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                {selectedApp.admin_notes && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">Admin Notes</h4>
                    <p className="text-muted-foreground text-sm">{selectedApp.admin_notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "NRC Front", url: selectedApp.nrc_front_url },
                    { label: "NRC Back", url: selectedApp.nrc_back_url },
                    { label: "Payslip", url: selectedApp.payslip_url },
                    { label: "Selfie", url: selectedApp.selfie_url },
                    { label: "Employer Letter", url: selectedApp.employer_letter_url },
                    { label: "Contract", url: selectedApp.contract_url },
                  ].map((doc) => (
                    <Card key={doc.label} className="bg-secondary/30 border-border/50">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-muted-foreground" />
                          <span className="text-foreground">{doc.label}</span>
                        </div>
                        {doc.url ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={14} className="mr-1" />
                              View
                            </a>
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not uploaded
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-4">
                {/* Status-based actions */}
                {selectedApp.status === 'pending' && (
                  <Card className="bg-secondary/30 border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <h4 className="font-semibold text-foreground">Review Application</h4>
                      <div className="space-y-2">
                        <Label>Rejection Reason (required if rejecting)</Label>
                        <Textarea
                          placeholder="Enter reason for rejection..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={handleReject}
                          disabled={isProcessing}
                        >
                          <XCircle size={16} className="mr-1" />
                          Reject
                        </Button>
                        <Button
                          onClick={handleApprove}
                          disabled={isProcessing}
                        >
                          <CheckCircle size={16} className="mr-1" />
                          Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedApp.status === 'approved' && (
                  <Card className="bg-secondary/30 border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <h4 className="font-semibold text-foreground">Disburse Loan</h4>
                      <p className="text-sm text-muted-foreground">
                        This loan is approved and ready for disbursement.
                      </p>
                      <Button onClick={() => setIsDisburseOpen(true)}>
                        <DollarSign size={16} className="mr-1" />
                        Disburse Now
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Delete action */}
                <Card className="bg-destructive/10 border-destructive/30">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-semibold text-destructive">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this loan application. This action cannot be undone.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setIsDeleteOpen(true)}
                    >
                      <Trash2 size={16} className="mr-1" />
                      Delete Application
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (selectedApp) {
                  generateLoanContract({
                    id: selectedApp.id,
                    full_name: selectedApp.full_name,
                    email: selectedApp.email,
                    phone: selectedApp.phone,
                    nrc_number: selectedApp.nrc_number,
                    address: selectedApp.address,
                    city: selectedApp.city,
                    date_of_birth: selectedApp.date_of_birth,
                    employer_name: selectedApp.employer_name,
                    job_title: selectedApp.job_title,
                    monthly_income: Number(selectedApp.monthly_income),
                    loan_amount: Number(selectedApp.loan_amount),
                    loan_term_months: selectedApp.loan_term_months,
                    interest_rate: Number(selectedApp.interest_rate),
                    monthly_payment: Number(selectedApp.monthly_payment),
                    total_repayment: Number(selectedApp.total_repayment),
                    loan_purpose: selectedApp.loan_purpose,
                    collateral_description: selectedApp.collateral_description,
                    collateral_value: selectedApp.collateral_value ? Number(selectedApp.collateral_value) : undefined,
                    created_at: selectedApp.created_at,
                  });
                }
              }}
            >
              <Printer size={16} className="mr-1" />
              Print Contract
            </Button>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disburse Dialog */}
      <Dialog open={isDisburseOpen} onOpenChange={setIsDisburseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Disburse Loan</DialogTitle>
            <DialogDescription>
              Enter disbursement details for K{Number(selectedApp?.loan_amount || 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Disbursement Method</Label>
              <Select
                value={disbursement.disbursement_method}
                onValueChange={(v) => setDisbursement({ ...disbursement, disbursement_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {disbursement.disbursement_method === 'bank_transfer' && (
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={disbursement.account_number}
                  onChange={(e) => setDisbursement({ ...disbursement, account_number: e.target.value })}
                  placeholder="Enter account number"
                />
              </div>
            )}

            {disbursement.disbursement_method === 'mobile_money' && (
              <div className="space-y-2">
                <Label>Mobile Money Number</Label>
                <Input
                  value={disbursement.mobile_money_number}
                  onChange={(e) => setDisbursement({ ...disbursement, mobile_money_number: e.target.value })}
                  placeholder="+260 97X XXX XXX"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Transaction Reference *</Label>
              <Input
                value={disbursement.transaction_reference}
                onChange={(e) => setDisbursement({ ...disbursement, transaction_reference: e.target.value })}
                placeholder="Enter transaction reference"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDisburseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDisburse} disabled={disburseMutation.isPending}>
              <DollarSign size={16} className="mr-1" />
              Confirm Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the loan application for{" "}
              <span className="font-semibold">{selectedApp?.full_name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedApp && deleteMutation.mutate(selectedApp.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminApplications;