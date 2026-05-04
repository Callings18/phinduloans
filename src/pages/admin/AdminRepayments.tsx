import { useState, useMemo, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { notificationService } from "@/utils/notificationService";
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
import { toast } from "sonner";
import { format, differenceInDays, isAfter } from "date-fns";
import {
  Receipt,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Plus,
  DollarSign,
  Calendar,
  User,
  Wallet,
  CreditCard,
  Phone,
  Building,
  Banknote,
  Download,
  FileText,
  Smartphone,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadRepaymentReceipt } from "@/utils/generateRepaymentReceipt";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import BulkActions, { defaultRepaymentActions } from "@/components/common/BulkActions";
import { Checkbox } from "@/components/ui/checkbox";
import PaginationControls from "@/components/common/PaginationControls";
import { DesktopTableWrap, MobileCardStack } from "@/components/common/ResponsiveDataViews";
import { fetchAdminPaymentClaims, reviewPaymentClaim } from "@/services/repositories/workflowRepository";

interface Repayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  transaction_reference: string | null;
  installment_number: number | null;
  principal_paid?: number | null;
  original_amount?: number | null;
  penalty_amount?: number | null;
  penalty_paid?: number | null;
  loan_applications?: {
    full_name: string;
    email: string;
    phone: string;
    loan_amount: number;
  };
}

interface PaymentClaim {
  id: string;
  loan_id: string;
  repayment_id: string;
  user_id: string;
  amount: number;
  reference: string;
  receipt_url: string | null;
  status: string;
  created_at: string;
}

const AdminRepayments = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canRecordPayment = can("repayments", "record");
  const canApprovePaymentClaim = can("repayments", "approve") || can("repayments", "record");
  const { data: settings } = useSystemSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState({
    payment_method: "mobile_money",
    transaction_reference: "",
    amount: "",
    penalty_amount: "",
    destination_account_id: "", // NEW: Which account to deposit to
  });
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: string; reference: string; destination_account_id: string }>>([
    { method: "mobile_money", amount: "", reference: "", destination_account_id: "" },
  ]);

  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRepayments, setSelectedRepayments] = useState<string[]>([]);

  // Fetch active accounts for deposit destination
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

  // Fetch repayments with server-side pagination
  const { data: repaymentsResult, isLoading } = useQuery({
    queryKey: ["admin-repayments", statusFilter, searchTerm, currentPage, pageSize],
    queryFn: async () => {
      let q = supabase
        .from("loan_repayments")
        .select(`
          *,
          loan_applications (
            full_name,
            email,
            phone,
            loan_amount
          )
        `, { count: "exact" })
        .order("due_date", { ascending: true });

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      q = q.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Repayment[], count: count ?? 0 };
    },
  });

  const repayments = repaymentsResult?.data ?? [];
  const totalCount = repaymentsResult?.count ?? 0;
  const principalRemaining = (repayment: Repayment | null) => {
    if (!repayment || repayment.status === "paid") return 0;
    return Math.max(0, Number(repayment.original_amount || repayment.amount || 0) - Number(repayment.principal_paid || 0));
  };
  const penaltyRemaining = (repayment: Repayment | null) => {
    if (!repayment || repayment.status === "paid" || repayment.status === "cancelled") return 0;
    return Math.max(0, Number(repayment.penalty_amount || 0) - Number(repayment.penalty_paid || 0));
  };
  const totalRemaining = (repayment: Repayment | null) => principalRemaining(repayment) + penaltyRemaining(repayment);

  // Pending borrower payment claims (for "Verify & record")
  const { data: paymentClaims = [] } = useQuery({
    queryKey: ["admin-payment-claims"],
    queryFn: async () => {
      const data = await fetchAdminPaymentClaims("pending_review");
      return (data || []) as unknown as PaymentClaim[];
    },
  });

  const claimsByRepaymentId = useMemo(() => {
    const map: Record<string, PaymentClaim> = {};
    for (const c of paymentClaims) {
      if (!map[c.repayment_id]) map[c.repayment_id] = c;
    }
    return map;
  }, [paymentClaims]);

  // Record payment mutation - supports partial payments; optional claimId to mark borrower claim as verified
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ repaymentId, paymentMethod, transactionRef, paidAmount, penaltyAmount, destinationAccountId, claimId }: { repaymentId: string; paymentMethod: string; transactionRef: string; paidAmount: number; penaltyAmount: number; destinationAccountId: string; claimId?: string | null }) => {
      const repayment = repayments?.find(r => r.id === repaymentId);
      if (!repayment) throw new Error("Repayment not found");
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }
      const unpaidPenalty = penaltyRemaining(repayment);
      if (!Number.isFinite(penaltyAmount) || penaltyAmount < 0) {
        throw new Error("Penalty allocation must be zero or greater");
      }
      if (penaltyAmount > paidAmount) {
        throw new Error("Penalty allocation cannot exceed the received amount");
      }
      if (penaltyAmount > unpaidPenalty + 0.01) {
        throw new Error(`Penalty allocation cannot exceed unpaid penalty (K${unpaidPenalty.toLocaleString()})`);
      }

      if (!destinationAccountId) {
        throw new Error("Please select a destination account for the payment");
      }
      if (claimId && !canApprovePaymentClaim) {
        throw new Error("Approval permission required to verify borrower payment claims.");
      }
      const amountDue = Number(repayment.amount) || 0;
      const paidDate = new Date().toISOString().split("T")[0];
      const { data: rpcData, error: rpcError } = await supabase.rpc("record_loan_payment", {
        p_repayment_id: repaymentId,
        p_amount: paidAmount,
        p_payment_method: paymentMethod,
        p_account_id: destinationAccountId,
        p_transaction_reference: transactionRef || `PAY-${Date.now()}`,
        p_paid_date: paidDate,
        p_penalty_amount: penaltyAmount,
      });
      if (rpcError) throw rpcError;
      const rpcResult = rpcData as { success?: boolean; error?: string } | null;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || "Failed to record payment");
      }

      if (claimId) {
        await reviewPaymentClaim({
          claimId,
          decision: "approved",
          reviewComment: "Payment verified by admin and recorded",
          decisionReasonCode: "verified_and_recorded",
        });
      }

      return { repayment, paidAmount, isFullPayment: paidAmount >= amountDue };
    },
    onSuccess: async ({ repayment, paidAmount, isFullPayment }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-repayments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-claims"] });
      queryClient.invalidateQueries({ queryKey: ["active-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-loans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });

      setSelectedClaimId(null);

      if (isFullPayment) {
        toast.success("Full payment recorded and deposited to account");
      } else {
        toast.success(`Partial payment of K${paidAmount.toLocaleString()} recorded and deposited`);
      }

      // Send SMS confirmation
      if (repayment?.loan_applications) {
        // Recompute from DB after mutation so notifications use authoritative values.
        const { data: refreshedRepayments } = await supabase
          .from("loan_repayments")
          .select("status, principal_paid, original_amount, amount")
          .eq("loan_id", repayment.loan_id);
        const loanRepayments = refreshedRepayments || [];
        // Sum principal_paid across ALL rows so partial payments count toward outstanding.
        const totalPaid = loanRepayments.reduce(
          (sum, r) => sum + Number(r.principal_paid || (r.status === "paid" ? (r.original_amount || r.amount) : 0) || 0),
          0,
        );
        const totalDue = loanRepayments.reduce((sum, r) => sum + Number(r.original_amount || r.amount), 0);
        const remainingBalance = Math.max(0, totalDue - totalPaid);

        await notificationService.sendPaymentConfirmation(
          repayment.user_id,
          repayment.loan_applications.full_name,
          paidAmount,
          remainingBalance,
          repayment.loan_applications.phone
        );

        if (remainingBalance <= 0) {
          await notificationService.sendLoanCompletion(
            repayment.user_id,
            repayment.loan_applications.full_name,
            repayment.loan_applications.phone
          );
        }
      }

      setIsRecordPaymentOpen(false);
      setSelectedRepayment(null);
        setPaymentData({ payment_method: "mobile_money", transaction_reference: "", amount: "", penalty_amount: "", destination_account_id: "" });
      setSelectedClaimId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const handleRecordPayment = (repayment: Repayment) => {
    setSelectedClaimId(null);
    setSelectedRepayment(repayment);
    setPaymentData({ payment_method: "mobile_money", transaction_reference: "", amount: "", penalty_amount: String(penaltyRemaining(repayment) || ""), destination_account_id: "" });
    setIsRecordPaymentOpen(true);
  };

  const handleVerifyClaim = (repayment: Repayment, claim: PaymentClaim) => {
    setSelectedRepayment(repayment);
    setPaymentData({
      payment_method: "mobile_money",
      transaction_reference: claim.reference,
      amount: String(claim.amount),
      penalty_amount: String(Math.min(Number(claim.amount || 0), penaltyRemaining(repayment)) || ""),
      destination_account_id: "",
    });
    setSelectedClaimId(claim.id);
    setIsRecordPaymentOpen(true);
  };

  const handleDownloadReceipt = async (repayment: Repayment) => {
    try {
      // Get loan details and calculate totals
      const { data: allRepayments } = await supabase
        .from('loan_repayments')
        .select('amount, status, principal_paid, original_amount')
        .eq('loan_id', repayment.loan_id);

      const { data: loan } = await supabase
        .from('loan_applications')
        .select('loan_amount, total_repayment, loan_term_months')
        .eq('id', repayment.loan_id)
        .single();

      const totalPaidFromPaid = allRepayments
        ?.filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0) || 0;
      const totalPartialOnPending = allRepayments
        ?.filter(r => r.status !== 'paid')
        .reduce((sum, r) => sum + Number(r.principal_paid || 0), 0) || 0;
      const totalPaid = totalPaidFromPaid + totalPartialOnPending;

      const outstandingBalance = (loan?.total_repayment || 0) - totalPaid;

      downloadRepaymentReceipt({
        borrowerName: repayment.loan_applications?.full_name || 'Unknown',
        borrowerPhone: repayment.loan_applications?.phone || '',
        borrowerEmail: repayment.loan_applications?.email || '',
        loanReference: `LOAN-${repayment.loan_id.substring(0, 8).toUpperCase()}`,
        loanAmount: loan?.loan_amount || 0,
        repaymentAmount: Number(repayment.principal_paid || repayment.original_amount || repayment.amount),
        paymentDate: repayment.paid_date || new Date().toISOString(),
        paymentMethod: repayment.payment_method || 'cash',
        transactionReference: repayment.transaction_reference || `TXN-${Date.now()}`,
        installmentNumber: repayment.installment_number || 1,
        totalInstallments: loan?.loan_term_months || 1,
        totalPaid,
        outstandingBalance,
        companyName: settings?.companyInfo?.name || 'PHINDU Finance',
        companyAddress: settings?.companyInfo?.address || 'Lusaka, Zambia',
        companyPhone: settings?.companyInfo?.support_phone || '+260 967 713 001',
      });

      toast.success('Receipt downloaded successfully');
    } catch (error: any) {
      toast.error('Failed to generate receipt');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepayment) return;

    if (isSplitPayment) {
      // Validate split payments
      const validSplits = splitPayments.filter(sp => sp.amount && parseFloat(sp.amount) > 0);
      if (validSplits.length === 0) {
        toast.error("Please enter at least one valid payment amount");
        return;
      }

      const totalSplitAmount = validSplits.reduce((sum, sp) => sum + parseFloat(sp.amount), 0);
      if (totalSplitAmount > Number(selectedRepayment.amount)) {
        toast.error(`Total split amount cannot exceed remaining due (K${Number(selectedRepayment.amount).toLocaleString()})`);
        return;
      }
      
      // For split payments we currently post one repayment transaction row.
      // Require all split legs to use the same destination account.
      const firstDestination = validSplits[0].destination_account_id;
      if (!firstDestination) {
        toast.error("Please select a destination account for at least one payment");
        return;
      }
      if (validSplits.some((sp) => !sp.destination_account_id)) {
        toast.error("Please select a destination account for each split payment");
        return;
      }
      if (validSplits.some((sp) => sp.destination_account_id !== firstDestination)) {
        toast.error("All split payments must use the same destination account");
        return;
      }

      // Record the payment with split info
      recordPaymentMutation.mutate({
        repaymentId: selectedRepayment.id,
        paymentMethod: "split", // Special indicator for split payment
        transactionRef: `SPLIT-${Date.now()}`,
        paidAmount: totalSplitAmount,
        destinationAccountId: firstDestination,
        claimId: selectedClaimId ?? undefined,
      });

      // Note: Split payments stored as separate repayment records would require schema changes
      // For now, log split payments in notes/audit log instead
      if (import.meta.env.DEV) console.log("Split payments recorded:", validSplits);
    } else {
      // Single payment method
      const paidAmount = paymentData.amount ? Number(paymentData.amount) : Number(selectedRepayment.amount);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        toast.error("Please enter a valid payment amount");
        return;
      }
      if (paidAmount > Number(selectedRepayment.amount)) {
        toast.error(`Amount cannot exceed remaining due (K${Number(selectedRepayment.amount).toLocaleString()})`);
        return;
      }

      if (!paymentData.destination_account_id) {
        toast.error("Please select a destination account");
        return;
      }

      recordPaymentMutation.mutate({
        repaymentId: selectedRepayment.id,
        paymentMethod: paymentData.payment_method,
        transactionRef: paymentData.transaction_reference,
        paidAmount,
        destinationAccountId: paymentData.destination_account_id,
        claimId: selectedClaimId ?? undefined,
      });
    }
  };

  const addSplitPayment = () => {
    setSplitPayments([...splitPayments, { method: "mobile_money", amount: "", reference: "", destination_account_id: "" }]);
  };

  const removeSplitPayment = (index: number) => {
    if (splitPayments.length > 1) {
      setSplitPayments(splitPayments.filter((_, i) => i !== index));
    }
  };

  const updateSplitPayment = (index: number, field: string, value: string) => {
    const updated = [...splitPayments];
    updated[index] = { ...updated[index], [field]: value };
    setSplitPayments(updated);
  };

  const getTotalSplitAmount = () => {
    return splitPayments.reduce((sum, sp) => sum + (parseFloat(sp.amount) || 0), 0);
  };

  const getStatusInfo = (repayment: Repayment) => {
    const today = new Date();
    const dueDate = new Date(repayment.due_date);
    const isOverdue = repayment.status === "pending" && isAfter(today, dueDate);
    const daysOverdue = isOverdue ? differenceInDays(today, dueDate) : 0;

    if (repayment.status === "paid") {
      return { status: "paid", color: "bg-success/20 text-success border-success/30", icon: CheckCircle };
    }
    if (isOverdue) {
      return {
        status: `${daysOverdue} days overdue`,
        color: "bg-destructive/20 text-destructive border-destructive/30",
        icon: AlertTriangle
      };
    }
    return { status: "pending", color: "bg-warning/20 text-warning border-warning/30", icon: Clock };
  };

  const filteredRepayments = searchTerm
    ? repayments.filter((rep) =>
        rep.loan_applications?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : repayments;

  // Toggle all selected repayments
  const toggleSelectAll = () => {
    if (selectedRepayments.length === filteredRepayments?.length) {
      setSelectedRepayments([]);
    } else {
      setSelectedRepayments(filteredRepayments?.map(r => r.id) || []);
    }
  };

  // Toggle single repayment selection
  const toggleSelectRepayment = (id: string) => {
    setSelectedRepayments(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Handle bulk action execution
  const handleBulkAction = async (actionId: string, inputValue?: string) => {
    if (selectedRepayments.length === 0) return;

    try {
    switch (actionId) {
      case 'mark_paid':
        toast.error("Bulk 'Mark Paid' is disabled to prevent non-atomic posting. Use Bulk Repayments or per-row Record Payment.");
        break;

      case 'send_reminder':
        // Send payment reminders to selected borrowers
        const reminderReps = repayments?.filter(r => selectedRepayments.includes(r.id));
        for (const rep of reminderReps || []) {
          if (rep.loan_applications?.phone && rep.user_id) {
            await notificationService.send({
              userId: rep.user_id,
              type: 'sms',
              to: rep.loan_applications.phone,
              title: 'Payment Reminder',
              message: inputValue || `Dear ${rep.loan_applications.full_name}, your payment of K${Number(rep.amount).toLocaleString()} is due on ${format(new Date(rep.due_date), 'MMM dd, yyyy')}. Please make your payment to avoid penalties.`,
            });
          }
        }
        toast.success(`Reminders sent to ${selectedRepayments.length} borrowers`);
        setSelectedRepayments([]);
        break;

      case 'export':
        // Export selected repayments to CSV
        const exportReps = repayments?.filter(r => selectedRepayments.includes(r.id));
        if (exportReps && exportReps.length > 0) {
          const headers = ['Borrower', 'Phone', 'Amount', 'Due Date', 'Status', 'Installment'];
          const rows = exportReps.map(r => [
            r.loan_applications?.full_name || 'Unknown',
            r.loan_applications?.phone || '',
            r.amount,
            format(new Date(r.due_date), 'yyyy-MM-dd'),
            r.status,
            r.installment_number || ''
          ]);
          const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `repayments_export_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setSelectedRepayments([]);
        break;

      default:
        throw new Error('Unknown action');
    }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    }
  };

  // Calculate stats
  const today = new Date();
  const stats = {
    total: repayments?.length || 0,
    pending: repayments?.filter((r) => r.status === "pending" || r.status === "partial").length || 0,
    paid: repayments?.filter((r) => r.status === "paid").length || 0,
    // Overdue = anything not yet fully paid/cancelled whose due date has passed
    overdue: repayments?.filter((r) =>
      r.status !== "paid" && r.status !== "cancelled" && isAfter(today, new Date(r.due_date))
    ).length || 0,
    // Total collected = principal_paid across paid + partial rows (real cash in)
    totalCollected: repayments
      ?.reduce((sum, r) => sum + Number(r.principal_paid || (r.status === "paid" ? (r.original_amount || r.amount) : 0) || 0), 0) || 0,
    // Total still due = original − principal_paid for everything not paid/cancelled
    totalPending: repayments
      ?.filter((r) => r.status !== "paid" && r.status !== "cancelled")
      .reduce((sum, r) => {
        const original = Number(r.original_amount || r.amount);
        const paid = Number(r.principal_paid || 0);
        return sum + Math.max(0, original - paid);
      }, 0) || 0,
  };

  // Real-time subscription for repayments
  useEffect(() => {
    const channel = supabase
      .channel('admin-repayments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_repayments' }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-repayments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchTerm]);

  // Paginate
  const paginatedRepayments = filteredRepayments;

  const RepaymentRowActions = ({ rep }: { rep: Repayment }) => (
    <div className="flex flex-col items-end gap-1 sm:items-end">
      {rep.status === "pending" && canRecordPayment && canApprovePaymentClaim && claimsByRepaymentId[rep.id] && (
        <div className="mb-1 flex max-w-full flex-col items-end gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">
            Borrower reported – pending verification
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-9 min-h-11 text-xs"
            onClick={() => handleVerifyClaim(rep, claimsByRepaymentId[rep.id])}
          >
            <CheckCircle size={12} className="mr-1" />
            Verify & record
          </Button>
        </div>
      )}
      {rep.status === "pending" && canRecordPayment && (
        <Button size="sm" onClick={() => handleRecordPayment(rep)} className="gradient-primary min-h-11 w-full sm:w-auto">
          <Plus size={14} className="mr-1" />
          Record Payment
        </Button>
      )}
      {rep.status === "paid" && (
        <div className="flex w-full flex-col items-stretch gap-2 sm:items-end">
          <span className="text-right text-sm text-muted-foreground">
            {rep.paid_date ? format(new Date(rep.paid_date), "MMM dd") : "-"}
          </span>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => handleDownloadReceipt(rep)} title="Download Receipt">
            <Download size={14} />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Repayments</h1>
          <p className="text-muted-foreground mt-1">
            Track and record loan repayments
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Receipt className="text-primary-foreground" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
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
                <p className="text-2xl font-bold text-foreground">{stats.paid}</p>
                <p className="text-sm text-muted-foreground">Paid</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="text-destructive" size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Wallet className="text-emerald-400" size={24} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">K{stats.totalCollected.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Collected</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Banknote className="text-purple-400" size={24} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">K{stats.totalPending.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
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
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedRepayments.length > 0 && (
          <BulkActions
            selectedIds={selectedRepayments}
            onAction={handleBulkAction}
            actions={defaultRepaymentActions.filter((a) => a.id !== "mark_paid")}
            entityName="repayments"
            onClearSelection={() => setSelectedRepayments([])}
          />
        )}

        {/* Repayments Table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Repayment Records</CardTitle>
            <CardDescription>All scheduled loan repayments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRepayments?.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No repayments found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Repayments will appear when loans are disbursed"}
                </p>
              </div>
            ) : (
              <>
              <DesktopTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRepayments.length === filteredRepayments?.length && filteredRepayments.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRepayments?.map((rep) => {
                    const statusInfo = getStatusInfo(rep);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={rep.id} className={`${statusInfo.status.includes("overdue") ? "bg-destructive/5" : ""} ${selectedRepayments.includes(rep.id) ? "bg-primary/5" : ""}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRepayments.includes(rep.id)}
                            onCheckedChange={() => toggleSelectRepayment(rep.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{rep.installment_number || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="text-primary" size={18} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{rep.loan_applications?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{rep.loan_applications?.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-foreground">K{Number(rep.original_amount || rep.amount).toLocaleString()}</p>
                        </TableCell>
                        <TableCell>
                          <p className={`font-semibold ${rep.principal_paid ? "text-success" : "text-muted-foreground"}`}>
                            {rep.principal_paid ? `K${Number(rep.principal_paid).toLocaleString()}` : rep.status === "paid" ? `K${Number(rep.amount).toLocaleString()}` : "-"}
                          </p>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            if (rep.status === "paid") return <span className="text-success font-semibold">K0</span>;
                            const instOriginal = Number(rep.original_amount || rep.amount);
                            const instPaid = Number(rep.principal_paid || 0);
                            const outstanding = Math.max(0, instOriginal - instPaid);
                            return <span className={outstanding > 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>K{outstanding.toLocaleString()}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            {format(new Date(rep.due_date), "MMM dd, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rep.paid_date ? (
                            <span className="font-medium text-success">
                              {format(new Date(rep.paid_date), "MMM dd, yyyy")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo.color}>
                            <StatusIcon size={12} className="mr-1" />
                            {statusInfo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rep.payment_method ? (
                            <div className="flex items-center gap-2 text-sm">
                              {rep.payment_method === "mobile_money" && <Phone size={14} />}
                              {rep.payment_method === "bank_transfer" && <Building size={14} />}
                              {rep.payment_method === "cash" && <Banknote size={14} />}
                              <span className="capitalize">{rep.payment_method.replace(/_/g, " ")}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {rep.transaction_reference || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <RepaymentRowActions rep={rep} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </DesktopTableWrap>
              <MobileCardStack>
                {paginatedRepayments?.map((rep) => {
                  const statusInfo = getStatusInfo(rep);
                  const StatusIcon = statusInfo.icon;
                  const instOriginal = Number(rep.original_amount || rep.amount);
                  const instPaid = Number(rep.principal_paid || 0);
                  const outstanding =
                    rep.status === "paid" ? 0 : Math.max(0, instOriginal - instPaid);
                  return (
                    <Card
                      key={rep.id}
                      className={`border-border/50 ${statusInfo.status.includes("overdue") ? "bg-destructive/5" : ""} ${selectedRepayments.includes(rep.id) ? "ring-2 ring-primary/30" : ""}`}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Checkbox
                            checked={selectedRepayments.includes(rep.id)}
                            onCheckedChange={() => toggleSelectRepayment(rep.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">#{rep.installment_number || "—"}</span>
                              <Badge variant="outline" className={statusInfo.color}>
                                <StatusIcon size={12} className="mr-1" />
                                {statusInfo.status}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                                <User className="text-primary" size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{rep.loan_applications?.full_name}</p>
                                <p className="truncate text-sm text-muted-foreground">{rep.loan_applications?.phone}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Installment</p>
                            <p className="font-semibold">K{Number(rep.original_amount || rep.amount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Outstanding</p>
                            <p className={outstanding > 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>
                              {rep.status === "paid" ? "K0" : `K${outstanding.toLocaleString()}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Due</p>
                            <p className="flex items-center gap-1">
                              <Calendar size={14} className="shrink-0 text-muted-foreground" />
                              {format(new Date(rep.due_date), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Paid</p>
                            <p>{rep.paid_date ? format(new Date(rep.paid_date), "MMM dd, yyyy") : "—"}</p>
                          </div>
                        </div>
                        {rep.payment_method && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Method:</span>{" "}
                            <span className="capitalize">{rep.payment_method.replace(/_/g, " ")}</span>
                            {rep.transaction_reference ? ` · ${rep.transaction_reference}` : ""}
                          </p>
                        )}
                        <RepaymentRowActions rep={rep} />
                      </CardContent>
                    </Card>
                  );
                })}
              </MobileCardStack>
              </>
            )}
          </CardContent>
          {(filteredRepayments?.length || 0) > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            />
          )}
        </Card>

        {/* Record Payment Dialog */}
        <Dialog open={isRecordPaymentOpen} onOpenChange={(open) => { setIsRecordPaymentOpen(open); if (!open) setSelectedClaimId(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a repayment for {selectedRepayment?.loan_applications?.full_name}
              </DialogDescription>
            </DialogHeader>
            {selectedRepayment && (
              <form onSubmit={submitPayment} className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount</span>
                    <span className="font-bold text-foreground">K{Number(selectedRepayment.original_amount || selectedRepayment.amount).toLocaleString()}</span>
                  </div>
                  {selectedRepayment.principal_paid && Number(selectedRepayment.principal_paid) > 0 && (
                    <div className="flex justify-between text-success">
                      <span className="text-muted-foreground">Already Paid</span>
                      <span className="font-medium">K{Number(selectedRepayment.principal_paid).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Due</span>
                    <span className="font-bold text-foreground">K{Number(selectedRepayment.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="text-foreground">{format(new Date(selectedRepayment.due_date), "MMM dd, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installment</span>
                    <span className="text-foreground">#{selectedRepayment.installment_number || "-"}</span>
                  </div>
                </div>

                {/* Split Payment Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div>
                    <Label className="font-medium">Split Payment</Label>
                    <p className="text-xs text-muted-foreground">Accept multiple payment methods</p>
                  </div>
                  <Button
                    type="button"
                    variant={isSplitPayment ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsSplitPayment(!isSplitPayment);
                      if (!isSplitPayment) {
                        setSplitPayments([{ method: "mobile_money", amount: "", reference: "", destination_account_id: "" }]);
                      }
                    }}
                  >
                    {isSplitPayment ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                {!isSplitPayment ? (
                  <>
                    <div className="space-y-2">
                      <Label>Payment Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max={selectedRepayment.amount}
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                        placeholder={`Full amount: K${Number(selectedRepayment.amount).toLocaleString()}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter amount received. Leave empty to record full payment of K{Number(selectedRepayment.amount).toLocaleString()}
                      </p>
                    </div>

                    {/* NEW: Destination Account Selection */}
                    <div className="space-y-2">
                      <Label>Deposit To Account *</Label>
                      <Select
                        value={paymentData.destination_account_id}
                        onValueChange={(value) => setPaymentData({ ...paymentData, destination_account_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account to deposit payment" />
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
                        Payment will be deposited to this account
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Method *</Label>
                      <Select
                        value={paymentData.payment_method}
                        onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
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
                          <SelectItem value="cash">
                            <div className="flex items-center gap-2">
                              <Banknote size={14} />
                              Cash
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Transaction Reference (Optional)</Label>
                      <Input
                        value={paymentData.transaction_reference}
                        onChange={(e) => setPaymentData({ ...paymentData, transaction_reference: e.target.value })}
                        placeholder="Enter reference number"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Split Payment Inputs */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Payment Methods</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addSplitPayment}>
                          <Plus size={14} className="mr-1" />
                          Add Method
                        </Button>
                      </div>

                      {splitPayments.map((split, index) => (
                        <div key={index} className="p-3 rounded-lg border border-border/50 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Payment {index + 1}</span>
                            {splitPayments.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeSplitPayment(index)}
                              >
                                <XCircle size={14} />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Method</Label>
                              <Select
                                value={split.method}
                                onValueChange={(value) => updateSplitPayment(index, "method", value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="cash">Cash</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-xs">Amount (ZMW)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={split.amount}
                                onChange={(e) => updateSplitPayment(index, "amount", e.target.value)}
                                placeholder="0.00"
                                className="h-9"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Reference (Optional)</Label>
                            <Input
                              value={split.reference}
                              onChange={(e) => updateSplitPayment(index, "reference", e.target.value)}
                              placeholder="Transaction ref"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Deposit To Account *</Label>
                            <Select
                              value={split.destination_account_id}
                              onValueChange={(value) => updateSplitPayment(index, "destination_account_id", value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.length === 0 ? (
                                  <SelectItem value="none" disabled>No active accounts available</SelectItem>
                                ) : (
                                  accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.account_name} (K{account.balance.toLocaleString()})
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}

                      {/* Split Payment Summary */}
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Split Amount:</span>
                          <span className="text-lg font-bold text-primary">K{getTotalSplitAmount().toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-xs">
                          <span className="text-muted-foreground">Amount Due:</span>
                          <span>K{Number(selectedRepayment.amount).toLocaleString()}</span>
                        </div>
                        {getTotalSplitAmount() < Number(selectedRepayment.amount) && (
                          <div className="flex justify-between items-center mt-1 text-xs text-warning">
                            <span>Remaining:</span>
                            <span>K{(Number(selectedRepayment.amount) - getTotalSplitAmount()).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsRecordPaymentOpen(false);
                      setSelectedRepayment(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-primary"
                    disabled={recordPaymentMutation.isPending}
                  >
                    {recordPaymentMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle size={16} className="mr-2" />
                    Confirm Payment
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRepayments;