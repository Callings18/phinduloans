import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notificationService } from "@/utils/notifications";
import { getSignedUrl } from "@/utils/storageHelpers";
import { useState } from "react";
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
  Download,
  Mail,
  MessageCircle,
  UserCheck,
  Loader2,
  Link2,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan } from "@/utils/loanCalculations";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateLoanContract, downloadLoanContract, emailContract, shareContractViaWhatsApp } from "@/utils/generateLoanContract";
import RiskAssessmentModule from "@/components/admin/RiskAssessmentModule";
import GuidedTour from "@/components/common/GuidedTour";
import { Step } from "react-joyride";
import { HelpCircle } from "lucide-react";
import BulkActions, { defaultLoanApplicationActions, BulkAction } from "@/components/common/BulkActions";
import { Checkbox } from "@/components/ui/checkbox";

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

const sourceConfig = {
  website: { label: "Website", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "🌐" },
  internal: { label: "Internal", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "🏢" },
  ussd: { label: "USSD", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: "📱" },
  mobile_app: { label: "Mobile App", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "📲" },
};

const AdminApplications = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);

  const tourSteps: Step[] = [
    {
      target: ".tour-apps-header",
      content: "Welcome to Applications Management. This is where you process all incoming loan requests.",
      placement: "bottom",
    },
    {
      target: ".tour-apps-filters",
      content: "Filter applications by status or search for specific borrowers to speed up your workflow.",
      placement: "bottom",
    },
    {
      target: ".tour-apps-list",
      content: "Review application details, attachments, and perform risk assessments directly from this list.",
      placement: "top",
    },
    {
      target: ".tour-apps-add",
      content: "Need to manually add a loan? Use this button to create a new application for an existing borrower.",
      placement: "left",
    }
  ];

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
    product_id: "",
    collateral_description: "",
    collateral_value: "",
    admin_notes: "",
  });

  // Document upload state
  const [documentFiles, setDocumentFiles] = useState<{
    collateral_image: File | null;
    bank_statement: File | null;
    payslip_1: File | null;
    payslip_2: File | null;
    payslip_3: File | null;
  }>({
    collateral_image: null,
    bank_statement: null,
    payslip_1: null,
    payslip_2: null,
    payslip_3: null,
  });
  const [isUploading, setIsUploading] = useState(false);

  // Disbursement form state
  const [disbursement, setDisbursement] = useState({
    disbursement_method: "bank_transfer",
    account_number: "",
    mobile_money_number: "",
    transaction_reference: "",
  });

  const [assigneeId, setAssigneeId] = useState<string>("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: applicationsData, isLoading } = useQuery({
    queryKey: ['admin-applications', statusFilter, currentPage, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('loan_applications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const applications = applicationsData?.data || [];
  const totalCount = applicationsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Placeholder for application docs - tables don't exist yet
  const applicationDocs: any[] = [];

  // Placeholder for workflow data - tables don't exist yet  
  const workflowStages: any[] = [];
  const workflowTransitions: any[] = [];
  const workflowHistory: any[] = [];

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

  // Fetch staff for assignment
  const { data: staffList } = useQuery({
    queryKey: ['staff-list-simple'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .neq('role', 'user')
        .neq('role', 'employer');

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return roles.map(role => ({
        ...role,
        profile: profiles?.find(p => p.id === role.user_id)
      }));
    }
  });

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async (data: { borrowerId: string; loanData: typeof newLoan; files: typeof documentFiles }) => {
      const borrower = borrowers?.find(b => b.id === data.borrowerId);
      if (!borrower) throw new Error('Borrower not found');

      const monthlyIncome = parseFloat(data.loanData.monthly_income);
      const loanAmount = parseFloat(data.loanData.loan_amount);
      const interestRate = parseFloat(data.loanData.interest_rate);
      const termMonths = parseInt(data.loanData.loan_term_months);

      // Get the selected product to use its interest period/type
      const selectedProduct = loanProducts?.find(p => p.id === data.loanData.product_id);

      // Use unified calculation utility
      const loanCalc = calculateLoan(loanAmount, termMonths, {
        interest_rate: interestRate,
        interest_period: (selectedProduct as any)?.interest_period || 'monthly',
        interest_type: (selectedProduct as any)?.interest_type || 'flat',
        processing_fee_percent: (selectedProduct as any)?.processing_fee_percent || 0,
        insurance_percent: (selectedProduct as any)?.insurance_percent || 0,
        vat_percent: (selectedProduct as any)?.vat_percent || 0,
        platform_fee_percent: (selectedProduct as any)?.platform_fee_percent || 0,
      });

      // First create the loan to get the ID
      const { data: insertedLoan, error: insertError } = await supabase.from('loan_applications').insert({
        user_id: borrower.id,
        loan_product_id: data.loanData.product_id || null,
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
        monthly_payment: loanCalc.monthlyPayment,
        total_repayment: loanCalc.totalRepayment,
        collateral_description: data.loanData.collateral_description || null,
        collateral_value: data.loanData.collateral_value ? parseFloat(data.loanData.collateral_value) : null,
        admin_notes: data.loanData.admin_notes || null,
        status: 'pending',
        source: 'internal',
      }).select('id').single();

      if (insertError) throw insertError;
      const loanId = insertedLoan.id;

      // Upload documents if provided
      const documentUrls: Record<string, string | null> = {
        collateral_image_url: null,
        bank_statement_url: null,
        payslip_url: null,
        payslip_2_url: null,
        payslip_3_url: null,
      };

      if (data.files.collateral_image) {
        documentUrls.collateral_image_url = await uploadDocumentFile(data.files.collateral_image, 'collateral', loanId);
      }
      if (data.files.bank_statement) {
        documentUrls.bank_statement_url = await uploadDocumentFile(data.files.bank_statement, 'bank_statement', loanId);
      }
      if (data.files.payslip_1) {
        documentUrls.payslip_url = await uploadDocumentFile(data.files.payslip_1, 'payslips', loanId);
      }
      if (data.files.payslip_2) {
        documentUrls.payslip_2_url = await uploadDocumentFile(data.files.payslip_2, 'payslips', loanId);
      }
      if (data.files.payslip_3) {
        documentUrls.payslip_3_url = await uploadDocumentFile(data.files.payslip_3, 'payslips', loanId);
      }

      // Update loan with document URLs if any were uploaded
      const hasDocuments = Object.values(documentUrls).some(url => url !== null);
      if (hasDocuments) {
        const updateData: Record<string, string> = {};
        Object.entries(documentUrls).forEach(([key, value]) => {
          if (value) updateData[key] = value;
        });

        await supabase.from('loan_applications').update(updateData).eq('id', loanId);
      }
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      
      // Show contract reminder for approved loans
      if (variables.status === 'approved') {
        toast({
          title: "Application Approved",
          description: "Don't forget to generate and send the loan contract to the borrower.",
          duration: 5000,
        });
      }

      // Trigger SMS notification
      if (variables.status === 'approved' && selectedApp) {
        notificationService.sendLoanApproval(
          selectedApp.user_id,
          selectedApp.full_name,
          selectedApp.loan_amount,
          selectedApp.phone
        );
      } else if (variables.status === 'rejected' && selectedApp) {
        notificationService.sendLoanRejection(
          selectedApp.user_id,
          selectedApp.full_name,
          selectedApp.phone,
          selectedApp.email,  // Fixed: Pass email here, not reason
          variables.reason    // Reason should be 5th param
        );
      }

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

      // Trigger Disbursement SMS notification
      if (selectedApp) {
        notificationService.sendDisbursementConfirmation(
          selectedApp.user_id,
          selectedApp.full_name,
          selectedApp.loan_amount,
          disbursement.transaction_reference || `TXN-${Date.now()}`,
          selectedApp.phone
        );
      }

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

  // Assign application mutation
  const assignMutation = useMutation({
    mutationFn: async ({ id, staffId }: { id: string; staffId: string }) => {
      const { error } = await supabase
        .from('loan_applications')
        .update({ assigned_to: staffId || null } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
      toast({ title: "Application assigned successfully" });
    },
    onError: (error) => {
      toast({ title: "Error assigning application", description: error.message, variant: "destructive" });
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
      product_id: "",
      collateral_description: "",
      collateral_value: "",
      admin_notes: "",
    });
    setDocumentFiles({
      collateral_image: null,
      bank_statement: null,
      payslip_1: null,
      payslip_2: null,
      payslip_3: null,
    });
  };

  const uploadDocumentFile = async (file: File, folder: string, loanId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${loanId}/${folder}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('loan-documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Return the file path instead of public URL for secure access via signed URLs
    return fileName;
  };

  // Helper to get signed URL for viewing documents securely
  const getSignedUrl = async (filePath: string | null): Promise<string | null> => {
    if (!filePath) return null;
    
    // If it's already a full URL (legacy data), return as-is
    if (filePath.startsWith('http')) return filePath;
    
    const { data, error } = await supabase.storage
      .from('loan-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  const handleProductSelect = (productId: string) => {
    const product = loanProducts?.find(p => p.id === productId);
    if (product) {
      setNewLoan({
        ...newLoan,
        product_id: productId,
        interest_rate: product.interest_rate.toString(),
        loan_term_months: product.max_term_months.toString(),
      });
    }
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

    // Check minimum credit score requirement from loan product
    const product = loanProducts?.find(p => p.id === selectedApp.loan_product_id);
    const minCreditScore = (product as any)?.min_credit_score || 0;

    if (minCreditScore > 0) {
      // Check if risk assessment exists with sufficient credit score
      const { data: riskAssessment } = await supabase
        .from('risk_assessments')
        .select('credit_score')
        .eq('loan_application_id', selectedApp.id)
        .maybeSingle();

      if (!riskAssessment) {
        toast({
          title: "Risk Assessment Required",
          description: `This product requires a credit score of at least ${minCreditScore}. Please complete the risk assessment first.`,
          variant: "destructive"
        });
        return;
      }

      if ((riskAssessment.credit_score || 0) < minCreditScore) {
        toast({
          title: "Credit Score Below Minimum",
          description: `Borrower's credit score (${riskAssessment.credit_score}) is below the required ${minCreditScore} for this product.`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);
    await updateStatusMutation.mutateAsync({ id: selectedApp.id, status: 'approved' });
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionCategory) {
      toast({ title: "Please select a rejection reason", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    const fullReason = rejectionReason 
      ? `${rejectionCategory}: ${rejectionReason}`
      : rejectionCategory;
    await updateStatusMutation.mutateAsync({
      id: selectedApp.id,
      status: 'rejected',
      reason: fullReason,
    });
    setIsProcessing(false);
    setRejectionCategory("");
    setRejectionReason("");
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
    createLoanMutation.mutate({ borrowerId: selectedBorrowerId, loanData: newLoan, files: documentFiles });
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

  const filteredApps = applications?.filter((app: any) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      (app.full_name?.toLowerCase() || '').includes(query) ||
      (app.email?.toLowerCase() || '').includes(query) ||
      (app.nrc_number?.toLowerCase() || '').includes(query) ||
      (app.phone?.toLowerCase() || '').includes(query);

    const matchesSource = sourceFilter === 'all' || (app as any).source === sourceFilter;

    return matchesSearch && matchesSource;
  });

  // Toggle select all applications
  const toggleSelectAll = () => {
    if (selectedApplications.length === filteredApps?.length) {
      setSelectedApplications([]);
    } else {
      setSelectedApplications(filteredApps?.map(app => app.id) || []);
    }
  };

  // Toggle single application selection
  const toggleSelectApplication = (id: string) => {
    setSelectedApplications(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Staff options for bulk assign
  const staffOptions = staffList?.map((s: any) => ({
    value: s.user_id,
    label: s.profile?.full_name || s.profile?.email || 'Unknown Staff'
  })) || [];

  // Bulk actions with dynamic staff options
  const bulkActions: BulkAction[] = defaultLoanApplicationActions.map(action => {
    if (action.id === 'assign') {
      return { ...action, selectOptions: staffOptions };
    }
    return action;
  });

  // Handle bulk action execution
  const handleBulkAction = async (actionId: string, inputValue?: string) => {
    if (selectedApplications.length === 0) return;

    switch (actionId) {
      case 'approve':
        // Bulk approve
        const approvePromises = selectedApplications.map(id =>
          supabase.from('loan_applications').update({ status: 'approved' }).eq('id', id)
        );
        await Promise.all(approvePromises);
        await queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
        setSelectedApplications([]);
        break;

      case 'reject':
        // Bulk reject with reason
        const rejectPromises = selectedApplications.map(id =>
          supabase.from('loan_applications').update({
            status: 'rejected',
            rejection_reason: inputValue || 'Bulk rejection'
          }).eq('id', id)
        );
        await Promise.all(rejectPromises);
        await queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
        setSelectedApplications([]);
        break;

      case 'assign':
        // Bulk assign to officer
        if (!inputValue) throw new Error('Please select an officer');
        const assignPromises = selectedApplications.map(id =>
          supabase.from('loan_applications').update({
            assigned_to: inputValue,
            status: 'under_review'
          }).eq('id', id)
        );
        await Promise.all(assignPromises);
        await queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
        setSelectedApplications([]);
        break;

      case 'send_email':
        // Get email addresses and send bulk email notification
        const emailApps = applications?.filter(app => selectedApplications.includes(app.id));
        for (const app of emailApps || []) {
          if (app.email && app.user_id) {
            await notificationService.send({
              userId: app.user_id,
              type: 'email',
              to: app.email,
              subject: 'Update on Your Loan Application',
              title: 'Update on Your Loan Application',
              message: inputValue || 'Your loan application status has been updated.',
            });
          }
        }
        setSelectedApplications([]);
        break;

      case 'send_sms':
        // Get phone numbers and send bulk SMS
        const smsApps = applications?.filter(app => selectedApplications.includes(app.id));
        for (const app of smsApps || []) {
          if (app.phone && app.user_id) {
            await notificationService.send({
              userId: app.user_id,
              type: 'sms',
              to: app.phone,
              title: 'Loan Application Update',
              message: inputValue || 'Your loan application status has been updated.',
            });
          }
        }
        setSelectedApplications([]);
        break;

      case 'export':
        // Export selected applications to CSV
        const exportApps = applications?.filter((app: any) => selectedApplications.includes(app.id));
        if (exportApps && exportApps.length > 0) {
          const headers = ['Name', 'Email', 'Phone', 'NRC', 'Amount', 'Status', 'Date'];
          const rows = exportApps.map(app => [
            app.full_name,
            app.email,
            app.phone,
            app.nrc_number,
            app.loan_amount,
            app.status,
            new Date(app.created_at).toLocaleDateString()
          ]);
          const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `applications_export_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setSelectedApplications([]);
        break;

      case 'delete':
        // Bulk delete
        const deletePromises = selectedApplications.map(id =>
          supabase.from('loan_applications').delete().eq('id', id)
        );
        await Promise.all(deletePromises);
        await queryClient.invalidateQueries({ queryKey: ['admin-applications'] });
        setSelectedApplications([]);
        break;

      default:
        throw new Error('Unknown action');
    }
  };

  return (
    <AdminLayout>
      <GuidedTour
        steps={tourSteps}
        tourKey="admin-applications"
        externalRun={runTour}
        onFinish={() => setRunTour(false)}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 tour-apps-header">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Loan Applications</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground mt-1">Review, add, and manage loan applications</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                onClick={() => setRunTour(true)}
              >
                <HelpCircle size={14} className="mr-1" />
                Tour
              </Button>
            </div>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 tour-apps-add">
            <Plus size={16} />
            Add Loan
          </Button>
        </div>

        {/* Filters */}
        <Card className="glass border-border/50 tour-apps-filters">
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
                <SelectTrigger className="w-full md:w-40">
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
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="website">🌐 Website</SelectItem>
                  <SelectItem value="internal">🏢 Internal</SelectItem>
                  <SelectItem value="ussd">📱 USSD</SelectItem>
                  <SelectItem value="mobile_app">📲 Mobile App</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedApplications.length > 0 && (
          <BulkActions
            selectedIds={selectedApplications}
            onAction={handleBulkAction}
            actions={bulkActions}
            entityName="applications"
            onClearSelection={() => setSelectedApplications([])}
          />
        )}

        {/* Select All Bar */}
        {filteredApps && filteredApps.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 glass rounded-lg border-border/50">
            <Checkbox
              id="select-all"
              checked={selectedApplications.length === filteredApps.length && filteredApps.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
              {selectedApplications.length === filteredApps.length && filteredApps.length > 0
                ? `All ${filteredApps.length} applications selected`
                : `Select all ${filteredApps.length} applications`}
            </label>
          </div>
        )}

        {/* Applications List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredApps && filteredApps.length > 0 ? (
          <>
            <div className="space-y-4 tour-apps-list">
              {filteredApps.map((app) => {
                const config = statusConfig[app.status as keyof typeof statusConfig];

                return (
                  <Card key={app.id} className={`glass border-border/50 hover:border-primary/30 transition-colors ${selectedApplications.includes(app.id) ? 'ring-2 ring-primary/50' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {/* Selection Checkbox */}
                          <div className="flex items-center">
                            <Checkbox
                              checked={selectedApplications.includes(app.id)}
                              onCheckedChange={() => toggleSelectApplication(app.id)}
                              className="mt-1"
                            />
                          </div>
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
                              <span className="flex items-center gap-1 text-primary">
                                <UserCheck size={12} />
                                {staffList?.find((s: any) => s.user_id === (app as any).assigned_to)?.profile?.full_name || 'Unassigned'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Source Badge */}
                          {(() => {
                            const src = (app as any).source as keyof typeof sourceConfig;
                            const srcConfig = sourceConfig[src] || sourceConfig.website;
                            return (
                              <Badge variant="outline" className={`${srcConfig.color} border text-xs`}>
                                {srcConfig.icon} {srcConfig.label}
                              </Badge>
                            );
                          })()}
                          {/* Status Badge */}
                          <Badge className={`${config?.color} border`}>
                            {config?.label}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApp(app);
                              setAssigneeId((app as any).assigned_to || "");
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 glass rounded-lg border-border/50">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} applications
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10"
                          disabled={isLoading}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || isLoading}
                  >
                    Next
                  </Button>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }} disabled={isLoading}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </>
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="borrower">Borrower</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="loan">Loan Details</TabsTrigger>
              <TabsTrigger value="collateral">Collateral</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
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
                <div className="col-span-2 space-y-2">
                  <Label>Loan Product *</Label>
                  <Select
                    value={newLoan.product_id}
                    onValueChange={handleProductSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loan product" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanProducts?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.interest_rate}% interest)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Loan Amount (K) *</Label>
                  <Input
                    type="number"
                    value={newLoan.loan_amount}
                    onChange={(e) => setNewLoan({ ...newLoan, loan_amount: e.target.value })}
                    placeholder="10000"
                  />
                  {newLoan.product_id && (() => {
                    const product = loanProducts?.find(p => p.id === newLoan.product_id);
                    if (product) {
                      return (
                        <p className="text-[10px] text-muted-foreground">
                          Limit: K{product.min_amount.toLocaleString()} - K{product.max_amount.toLocaleString()}
                        </p>
                      );
                    }
                  })()}
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
                    disabled={!!newLoan.product_id}
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
              {newLoan.loan_amount && newLoan.loan_term_months && newLoan.interest_rate && (() => {
                const selectedProduct = loanProducts?.find(p => p.id === newLoan.product_id);
                const loanCalc = calculateLoan(
                  parseFloat(newLoan.loan_amount),
                  parseInt(newLoan.loan_term_months),
                  {
                    interest_rate: parseFloat(newLoan.interest_rate),
                    interest_period: selectedProduct?.interest_period as any,
                    interest_type: selectedProduct?.interest_type as any,
                    processing_fee_percent: selectedProduct?.processing_fee_percent,
                    insurance_percent: selectedProduct?.insurance_percent,
                    vat_percent: selectedProduct?.vat_percent,
                    platform_fee_percent: selectedProduct?.platform_fee_percent,
                  }
                );
                return (
                  <Card className="bg-secondary/50 border-border/50">
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 text-foreground">Loan Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-medium text-foreground">K{parseFloat(newLoan.loan_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Service Fees (deducted)</p>
                          <p className="font-medium text-destructive">-K{loanCalc.feesDeductedUpfront.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="col-span-2 p-3 bg-primary/10 rounded-lg">
                          <p className="text-muted-foreground text-xs">Borrower Receives</p>
                          <p className="font-bold text-primary text-lg">K{loanCalc.disbursementAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Payment</p>
                          <p className="font-medium text-foreground">K{loanCalc.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Repayment</p>
                          <p className="font-medium text-foreground">K{loanCalc.totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
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

            <TabsContent value="documents" className="space-y-4 mt-4">
              <div className="space-y-6">
                {/* Collateral Image */}
                <div className="space-y-2">
                  <Label>Collateral Image</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDocumentFiles({
                        ...documentFiles,
                        collateral_image: e.target.files?.[0] || null
                      })}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {documentFiles.collateral_image && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {documentFiles.collateral_image.name}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Upload a photo of the collateral (vehicle, property, etc.)</p>
                </div>

                {/* Bank Statement */}
                <div className="space-y-2">
                  <Label>Bank Statement</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setDocumentFiles({
                        ...documentFiles,
                        bank_statement: e.target.files?.[0] || null
                      })}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                    {documentFiles.bank_statement && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {documentFiles.bank_statement.name}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Upload recent bank statement (PDF or image)</p>
                </div>

                {/* Payslips */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Payslips (3 months)</Label>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Payslip 1 */}
                    <div className="space-y-2">
                      <Label className="text-sm">Payslip 1 (Latest)</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-3">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setDocumentFiles({
                            ...documentFiles,
                            payslip_1: e.target.files?.[0] || null
                          })}
                          className="file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                        {documentFiles.payslip_1 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {documentFiles.payslip_1.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Payslip 2 */}
                    <div className="space-y-2">
                      <Label className="text-sm">Payslip 2</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-3">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setDocumentFiles({
                            ...documentFiles,
                            payslip_2: e.target.files?.[0] || null
                          })}
                          className="file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                        {documentFiles.payslip_2 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {documentFiles.payslip_2.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Payslip 3 */}
                    <div className="space-y-2">
                      <Label className="text-sm">Payslip 3</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-3">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setDocumentFiles({
                            ...documentFiles,
                            payslip_3: e.target.files?.[0] || null
                          })}
                          className="file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                        {documentFiles.payslip_3 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {documentFiles.payslip_3.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Upload 3 consecutive months of payslips</p>
                </div>
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="risk">Risk Review</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Activity size={14} /> History
                </TabsTrigger>
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
                    <div>
                      <p className="text-muted-foreground">Assigned Officer</p>
                      <p className="text-primary font-medium flex items-center gap-1">
                        <UserCheck size={14} />
                        {staffList?.find((s: any) => s.user_id === selectedApp.assigned_to)?.profile?.full_name || 'Unassigned'}
                      </p>
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
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <CreditCard size={18} />
                      Loan Details
                    </h4>
                    {selectedApp.loan_product_id && (() => {
                      const product = loanProducts?.find(p => p.id === selectedApp.loan_product_id);
                      return product ? (
                        <Badge variant="outline" className="text-xs">
                          {product.name}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Loan Amount</p>
                      <p className="text-foreground font-medium text-lg">K{Number(selectedApp.loan_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Term</p>
                      <p className="text-foreground font-medium">{selectedApp.loan_term_months} {(selectedApp as any).term_unit || 'months'}</p>
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
                {/* Dynamic Documents */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {applicationDocs && applicationDocs.length > 0 ? (
                    applicationDocs.map((doc: any) => (
                      <Card key={doc.id} className="bg-secondary/30 border-border/50">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <FileText size={18} className="text-muted-foreground" />
                              <span className="text-foreground font-medium uppercase text-xs">
                                {doc.document_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.file_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={
                              doc.status === 'verified' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                doc.status === 'rejected' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                  "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            }>
                              {doc.status}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={async () => {
                                const signedUrl = await getSignedUrl(doc.file_url);
                                if (signedUrl) {
                                  window.open(signedUrl, '_blank');
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to load document. Please try again.",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <ExternalLink size={14} className="mr-1" />
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-2 py-12 text-center border-2 border-dashed rounded-xl border-border bg-secondary/10">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                      <p className="text-muted-foreground text-sm">No dynamic documents found for this application.</p>
                      <p className="text-xs text-muted-foreground/60">Check legacy folder if application is old.</p>
                    </div>
                  )}
                </div>

                {/* Legacy Documents (fallback) */}
                {(selectedApp.nrc_front_url || selectedApp.nrc_back_url || selectedApp.selfie_url || selectedApp.payslip_url) && (
                  <div className="pt-6 border-t border-border mt-4">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                      <Link2 size={16} />
                      Legacy / Standard Documents
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { label: "NRC Front", url: selectedApp.nrc_front_url },
                        { label: "NRC Back", url: selectedApp.nrc_back_url },
                        { label: "Selfie", url: selectedApp.selfie_url },
                        { label: "Payslip 1", url: selectedApp.payslip_url },
                        { label: "Payslip 2", url: selectedApp.payslip_2_url },
                        { label: "Payslip 3", url: selectedApp.payslip_3_url },
                        { label: "Bank Statement", url: selectedApp.bank_statement_url },
                        { label: "Employer Letter", url: selectedApp.employer_letter_url },
                        { label: "Collateral Image", url: selectedApp.collateral_image_url },
                      ].filter(d => d.url).map((doc) => (
                        <Card key={doc.label} className="bg-secondary/20 border-border/30">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-muted-foreground" />
                              <span className="text-sm text-foreground">{doc.label}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={async () => {
                                const signedUrl = await getSignedUrl(doc.url);
                                if (signedUrl) {
                                  window.open(signedUrl, '_blank');
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to load document. Please try again.",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              <ExternalLink size={12} className="mr-1" />
                              View
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risk" className="space-y-4 mt-4">
                <RiskAssessmentModule applicationId={selectedApp.id} />
              </TabsContent>

              <TabsContent value="actions" className="space-y-6 mt-4">
                {/* Workflow section placeholder - feature coming soon */}

                {/* Status-based actions */}
                <div className="pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Application Context</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedApp.status === 'pending' && (
                      <Card className="bg-secondary/30 border-border/50">
                        <CardContent className="p-4 space-y-4">
                          <h4 className="font-semibold text-foreground">Review Application</h4>
                          <div className="space-y-2">
                            <Label>Rejection Reason *</Label>
                            <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select rejection reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Insufficient Income">Insufficient Income</SelectItem>
                                <SelectItem value="Poor Credit History">Poor Credit History</SelectItem>
                                <SelectItem value="Incomplete Documentation">Incomplete Documentation</SelectItem>
                                <SelectItem value="High Debt-to-Income Ratio">High Debt-to-Income Ratio</SelectItem>
                                <SelectItem value="Unstable Employment">Unstable Employment</SelectItem>
                                <SelectItem value="Failed CRB Check">Failed CRB Check</SelectItem>
                                <SelectItem value="Insufficient Collateral">Insufficient Collateral</SelectItem>
                                <SelectItem value="Age Requirement Not Met">Age Requirement Not Met</SelectItem>
                                <SelectItem value="Duplicate Application">Duplicate Application</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Additional Details (Optional)</Label>
                            <Textarea
                              placeholder="Add more context or specific details..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={handleReject}
                              disabled={isProcessing}
                            >
                              <XCircle size={16} className="mr-1" />
                              Reject
                            </Button>
                            <Button
                              className="flex-1"
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
                          <Button onClick={() => setIsDisburseOpen(true)} className="w-full">
                            <DollarSign size={16} className="mr-1" />
                            Disburse Now
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Quick Print/Actions */}
                    <Card className="bg-secondary/30 border-border/50">
                      <CardContent className="p-4 space-y-4">
                        <h4 className="font-semibold text-foreground">Communication</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer size={14} className="mr-1" /> Print
                          </Button>
                          <Button variant="outline" size="sm">
                            <Mail size={14} className="mr-1" /> Email
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Assignment action */}
                <div className="pt-6 border-t border-border">
                  <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Assignment</h4>
                  <Card className="bg-secondary/30 border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Select Staff Member</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {staffList?.map((staff: any) => (
                              <SelectItem key={staff.user_id} value={staff.user_id}>
                                {staff.profile?.full_name || staff.profile?.email} ({staff.role.replace('_', ' ')})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => assignMutation.mutate({
                          id: selectedApp.id,
                          staffId: assigneeId === "unassigned" ? "" : assigneeId
                        })}
                        disabled={assignMutation.isPending}
                      >
                        {assignMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                        Update Assignment
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Delete action */}
                <div className="pt-6 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/5"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete Application
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4 space-y-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Workflow Audit Log</h4>

                  {workflowHistory && workflowHistory.length > 0 ? (
                    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                      {workflowHistory.map((item: any) => (
                        <div key={item.id} className="relative flex items-start gap-4 pl-10">
                          <div className="absolute left-0 flex items-center justify-center w-10 h-10 rounded-full bg-secondary border border-border shadow-sm">
                            <Activity size={16} className="text-primary" />
                          </div>
                          <Card className="flex-1 bg-secondary/30 border-border/50">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold">
                                    {item.from_stage?.name || 'Start'} → {item.to_stage?.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.performed_by_profile?.full_name || 'System'}
                                </Badge>
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground italic bg-background/50 p-2 rounded border border-border/30">
                                  "{item.notes}"
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                      <Activity size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No history available for this application.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (selectedApp) {
                    await generateLoanContract({
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
                      loan_product_id: selectedApp.loan_product_id,
                    });
                  }
                }}
              >
                <Printer size={16} className="mr-1" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (selectedApp) {
                    await downloadLoanContract({
                      id: selectedApp.id,
                      full_name: selectedApp.full_name,
                      email: selectedApp.email,
                      phone: selectedApp.phone,
                      nrc_number: selectedApp.nrc_number,
                      address: selectedApp.address,
                      city: selectedApp.city,
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
                      loan_product_id: selectedApp.loan_product_id,
                    });
                  }
                }}
              >
                <Download size={16} className="mr-1" />
                Save PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (selectedApp) {
                    await emailContract({
                      id: selectedApp.id,
                      full_name: selectedApp.full_name,
                      email: selectedApp.email,
                      phone: selectedApp.phone,
                      nrc_number: selectedApp.nrc_number,
                      address: selectedApp.address,
                      city: selectedApp.city,
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
                      loan_product_id: selectedApp.loan_product_id,
                    });
                  }
                }}
              >
                <Mail size={16} className="mr-1" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (selectedApp) {
                    await shareContractViaWhatsApp({
                      id: selectedApp.id,
                      full_name: selectedApp.full_name,
                      email: selectedApp.email,
                      phone: selectedApp.phone,
                      nrc_number: selectedApp.nrc_number,
                      address: selectedApp.address,
                      city: selectedApp.city,
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
                      loan_product_id: selectedApp.loan_product_id,
                    });
                  }
                }}
              >
                <MessageCircle size={16} className="mr-1" />
                WhatsApp
              </Button>
            </div>
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
                  placeholder="+260 967 713 001"
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
    </AdminLayout >
  );
};

export default AdminApplications;