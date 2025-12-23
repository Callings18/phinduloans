import { useState } from "react";
import { format, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
  Undo2,
  CreditCard,
  Loader2,
  Plus,
  Banknote,
  TrendingUp,
  History,
  MessageSquare,
  Activity,
  Settings,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  nrc_number: string;
  address?: string | null;
  city?: string | null;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  total_repayment: number;
  monthly_payment: number;
  status: string;
  created_at: string;
  loan_purpose: string;
  employment_type: string;
  monthly_income?: number;
  employer_name?: string | null;
  job_title?: string | null;
  admin_notes?: string | null;
}

interface Repayment {
  id: string;
  loan_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  installment_number: number | null;
  payment_method: string | null;
  transaction_reference: string | null;
}

interface Props {
  loan: Loan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LoanDetailsModal({ loan, open, onOpenChange }: Props) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isRestructureOpen, setIsRestructureOpen] = useState(false);
  const [newTermMonths, setNewTermMonths] = useState("");
  const [newInterestRate, setNewInterestRate] = useState("");
  const [restructureReason, setRestructureReason] = useState("");
  const [isUndoDisbursementOpen, setIsUndoDisbursementOpen] = useState(false);
  const [isGenerateScheduleOpen, setIsGenerateScheduleOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState(loan?.admin_notes || "");

  const queryClient = useQueryClient();

  // Fetch repayments
  const { data: repayments, isLoading: repaymentsLoading } = useQuery({
    queryKey: ["loan-repayments", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Repayment[];
    },
    enabled: !!loan,
  });

  // Fetch disbursement
  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursement", loan?.id],
    queryFn: async () => {
      if (!loan) return null;
      const { data, error } = await supabase
        .from("disbursements")
        .select("*")
        .eq("loan_id", loan.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!loan,
  });

  // Fetch collection activities
  const { data: collectionActivities } = useQuery({
    queryKey: ["loan-collection-activities", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const { data, error } = await supabase
        .from("collection_activities")
        .select("*")
        .eq("loan_id", loan.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!loan,
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRepayment) throw new Error("No repayment selected");
      
      const amount = paymentAmount ? Number(paymentAmount) : selectedRepayment.amount;
      
      const { error } = await supabase
        .from("loan_repayments")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
          payment_method: paymentMethod,
          transaction_reference: transactionRef || null,
          amount: amount,
        })
        .eq("id", selectedRepayment.id);

      if (error) throw error;

      // Check if all repayments are paid to mark loan as completed
      const { data: remainingPending } = await supabase
        .from("loan_repayments")
        .select("id")
        .eq("loan_id", loan?.id)
        .eq("status", "pending");

      if (remainingPending && remainingPending.length === 1) {
        // This was the last pending payment
        await supabase
          .from("loan_applications")
          .update({ status: "completed" })
          .eq("id", loan?.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Payment recorded successfully");
      setIsRecordPaymentOpen(false);
      setSelectedRepayment(null);
      setPaymentMethod("cash");
      setTransactionRef("");
      setPaymentAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  // Generate repayment schedule mutation
  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      const monthlyPayment = loan.monthly_payment || (loan.total_repayment / loan.loan_term_months);
      const repaymentRecords = [];
      const startDate = new Date();

      for (let i = 1; i <= loan.loan_term_months; i++) {
        repaymentRecords.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: monthlyPayment,
          due_date: format(addMonths(startDate, i), "yyyy-MM-dd"),
          installment_number: i,
          status: "pending",
        });
      }

      const { error } = await supabase
        .from("loan_repayments")
        .insert(repaymentRecords);

      if (error) throw error;

      // Update loan status to active
      await supabase
        .from("loan_applications")
        .update({ status: "active" })
        .eq("id", loan.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Repayment schedule generated successfully");
      setIsGenerateScheduleOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate schedule");
    },
  });

  // Restructure loan mutation
  const restructureLoanMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      const newTerm = Number(newTermMonths) || loan.loan_term_months;
      const newRate = Number(newInterestRate) || loan.interest_rate;
      
      // Recalculate loan
      const principal = loan.loan_amount;
      const interest = principal * (newRate / 100) * newTerm;
      const newTotal = principal + interest;
      const newMonthly = newTotal / newTerm;

      // Update loan
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({
          loan_term_months: newTerm,
          interest_rate: newRate,
          total_repayment: newTotal,
          monthly_payment: newMonthly,
          admin_notes: `${loan.admin_notes || ""}\n\n[RESTRUCTURED ${format(new Date(), "yyyy-MM-dd")}]: ${restructureReason}\nNew terms: ${newTerm} months @ ${newRate}%`,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // Delete pending repayments and regenerate
      await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id)
        .eq("status", "pending");

      // Get paid count to continue numbering
      const { data: paidRepayments } = await supabase
        .from("loan_repayments")
        .select("installment_number")
        .eq("loan_id", loan.id)
        .eq("status", "paid")
        .order("installment_number", { ascending: false });

      const lastPaidInstallment = paidRepayments?.[0]?.installment_number || 0;
      const remainingInstallments = newTerm - lastPaidInstallment;

      // Generate new schedule
      const repaymentRecords = [];
      const startDate = new Date();

      for (let i = 1; i <= remainingInstallments; i++) {
        repaymentRecords.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          amount: newMonthly,
          due_date: format(addMonths(startDate, i), "yyyy-MM-dd"),
          installment_number: lastPaidInstallment + i,
          status: "pending",
        });
      }

      if (repaymentRecords.length > 0) {
        const { error } = await supabase
          .from("loan_repayments")
          .insert(repaymentRecords);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Loan restructured successfully");
      setIsRestructureOpen(false);
      setNewTermMonths("");
      setNewInterestRate("");
      setRestructureReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to restructure loan");
    },
  });

  // Undo disbursement mutation
  const undoDisbursementMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");

      // Delete disbursement record
      await supabase
        .from("disbursements")
        .delete()
        .eq("loan_id", loan.id);

      // Delete all repayments
      await supabase
        .from("loan_repayments")
        .delete()
        .eq("loan_id", loan.id);

      // Revert loan status to approved
      const { error } = await supabase
        .from("loan_applications")
        .update({ status: "approved" })
        .eq("id", loan.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-repayments", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-disbursement", loan?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Disbursement undone - loan reverted to approved status");
      setIsUndoDisbursementOpen(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to undo disbursement");
    },
  });

  // Update loan status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: "active" | "completed" | "defaulted" | "disbursed" | "pending" | "approved" | "rejected" | "under_review") => {
      if (!loan) throw new Error("No loan selected");
      const { error } = await supabase
        .from("loan_applications")
        .update({ status })
        .eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      toast.success("Loan status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      const { error } = await supabase
        .from("loan_applications")
        .update({ admin_notes: adminNotes })
        .eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes saved");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save notes");
    },
  });

  if (!loan) return null;

  // Calculate progress
  const paidRepayments = repayments?.filter(r => r.status === "paid") || [];
  const totalPaid = paidRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
  const progressPercentage = loan.total_repayment > 0 ? (totalPaid / loan.total_repayment) * 100 : 0;
  const overdueCount = repayments?.filter(r => r.status === "pending" && new Date(r.due_date) < new Date()).length || 0;
  const nextDue = repayments?.find(r => r.status === "pending" && new Date(r.due_date) >= new Date());

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      active: { color: "bg-success/20 text-success border-success/30", icon: Activity },
      disbursed: { color: "bg-info/20 text-info border-info/30", icon: Banknote },
      completed: { color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle },
      defaulted: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      paid: { color: "bg-success/20 text-success border-success/30", icon: CheckCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-3">
                  <User size={24} className="text-primary" />
                  {loan.full_name}
                  {getStatusBadge(loan.status)}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Loan ID: {loan.id.slice(0, 8)}... • Created {format(new Date(loan.created_at), "MMM dd, yyyy")}
                </DialogDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">K{Number(loan.loan_amount).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{loan.loan_term_months} months @ {loan.interest_rate}%</p>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                <TrendingUp size={14} className="mr-1 hidden sm:inline" /> Overview
              </TabsTrigger>
              <TabsTrigger value="repayments" className="text-xs sm:text-sm">
                <Receipt size={14} className="mr-1 hidden sm:inline" /> Repayments
              </TabsTrigger>
              <TabsTrigger value="borrower" className="text-xs sm:text-sm">
                <User size={14} className="mr-1 hidden sm:inline" /> Borrower
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs sm:text-sm">
                <Settings size={14} className="mr-1 hidden sm:inline" /> Actions
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">
                <History size={14} className="mr-1 hidden sm:inline" /> History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto pt-4">
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="text-lg font-bold">K{Number(loan.loan_amount).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Total Repayment</p>
                      <p className="text-lg font-bold">K{Number(loan.total_repayment).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Monthly Payment</p>
                      <p className="text-lg font-bold">K{Number(loan.monthly_payment || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Interest Rate</p>
                      <p className="text-lg font-bold">{loan.interest_rate}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress */}
                {repayments && repayments.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Repayment Progress</p>
                        <p className="text-sm text-muted-foreground">
                          {paidRepayments.length} of {repayments.length} payments
                        </p>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                      <div className="flex justify-between text-sm">
                        <span className="text-success">Paid: K{totalPaid.toLocaleString()}</span>
                        <span className="text-muted-foreground">Remaining: K{(loan.total_repayment - totalPaid).toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts */}
                <div className="flex flex-wrap gap-3">
                  {overdueCount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="text-destructive" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Overdue Payments</p>
                        <p className="font-medium text-destructive">{overdueCount} installments</p>
                      </div>
                    </div>
                  )}
                  {nextDue && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                      <Calendar className="text-info" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Next Due Date</p>
                        <p className="font-medium">{format(new Date(nextDue.due_date), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                  )}
                  {disbursement && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                      <Banknote className="text-success" size={18} />
                      <div>
                        <p className="text-xs text-muted-foreground">Disbursed</p>
                        <p className="font-medium">{disbursement.disbursed_at ? format(new Date(disbursement.disbursed_at), "MMM dd, yyyy") : "Pending"}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {(!repayments || repayments.length === 0) && (
                      <Button size="sm" onClick={() => setIsGenerateScheduleOpen(true)}>
                        <Plus size={14} className="mr-1" /> Generate Schedule
                      </Button>
                    )}
                    {repayments && repayments.length > 0 && (
                      <Button size="sm" onClick={() => {
                        const nextPending = repayments.find(r => r.status === "pending");
                        if (nextPending) {
                          setSelectedRepayment(nextPending);
                          setIsRecordPaymentOpen(true);
                        }
                      }}>
                        <CreditCard size={14} className="mr-1" /> Record Payment
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setIsRestructureOpen(true)}>
                      <RefreshCw size={14} className="mr-1" /> Restructure
                    </Button>
                    {(loan.status === "disbursed" || loan.status === "active") && paidRepayments.length === 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setIsUndoDisbursementOpen(true)}>
                        <Undo2 size={14} className="mr-1" /> Undo Disbursement
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Repayments Tab */}
              <TabsContent value="repayments" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Repayment Schedule</h3>
                  {(!repayments || repayments.length === 0) ? (
                    <Button size="sm" onClick={() => setIsGenerateScheduleOpen(true)}>
                      <Plus size={14} className="mr-1" /> Generate Schedule
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => {
                      const nextPending = repayments.find(r => r.status === "pending");
                      if (nextPending) {
                        setSelectedRepayment(nextPending);
                        setIsRecordPaymentOpen(true);
                      } else {
                        toast.info("No pending repayments");
                      }
                    }}>
                      <CreditCard size={14} className="mr-1" /> Record Payment
                    </Button>
                  )}
                </div>

                {repaymentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-primary" size={32} />
                  </div>
                ) : repayments && repayments.length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Paid Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repayments.map((rep) => {
                          const isOverdue = rep.status === "pending" && new Date(rep.due_date) < new Date();
                          return (
                            <TableRow key={rep.id} className={isOverdue ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{rep.installment_number || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {format(new Date(rep.due_date), "MMM dd, yyyy")}
                                  {isOverdue && <AlertTriangle className="text-destructive" size={14} />}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">K{Number(rep.amount).toLocaleString()}</TableCell>
                              <TableCell>{getStatusBadge(isOverdue ? "overdue" : rep.status)}</TableCell>
                              <TableCell>
                                {rep.paid_date ? format(new Date(rep.paid_date), "MMM dd, yyyy") : "-"}
                              </TableCell>
                              <TableCell className="capitalize">{rep.payment_method || "-"}</TableCell>
                              <TableCell className="text-right">
                                {rep.status === "pending" && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRepayment(rep);
                                      setPaymentAmount(rep.amount.toString());
                                      setIsRecordPaymentOpen(true);
                                    }}
                                  >
                                    <CheckCircle size={14} className="mr-1" /> Pay
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Repayment Schedule</h3>
                    <p className="text-muted-foreground mb-4">Generate a repayment schedule for this loan</p>
                    <Button onClick={() => setIsGenerateScheduleOpen(true)}>
                      <Plus size={16} className="mr-2" /> Generate Schedule
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Borrower Tab */}
              <TabsContent value="borrower" className="m-0 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User size={16} /> Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Full Name</p>
                          <p className="font-medium">{loan.full_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium">{loan.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium">{loan.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">NRC Number</p>
                          <p className="font-medium">{loan.nrc_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="font-medium">{loan.address || "N/A"}, {loan.city || ""}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase size={16} /> Employment Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Briefcase size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Employment Type</p>
                          <p className="font-medium capitalize">{loan.employment_type?.replace("_", " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <DollarSign size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Monthly Income</p>
                          <p className="font-medium">K{Number(loan.monthly_income || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      {loan.employer_name && (
                        <div className="flex items-center gap-3">
                          <Briefcase size={16} className="text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Employer</p>
                            <p className="font-medium">{loan.employer_name}</p>
                          </div>
                        </div>
                      )}
                      {loan.job_title && (
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Job Title</p>
                            <p className="font-medium">{loan.job_title}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Loan Purpose</p>
                          <p className="font-medium capitalize">{loan.loan_purpose?.replace("_", " ")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="m-0 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Loan Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Loan Status</CardTitle>
                      <CardDescription>Change the status of this loan</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {loan.status !== "active" && (
                        <Button size="sm" onClick={() => updateStatusMutation.mutate("active")}>
                          <Activity size={14} className="mr-1" /> Mark Active
                        </Button>
                      )}
                      {loan.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate("completed")}>
                          <CheckCircle size={14} className="mr-1" /> Mark Completed
                        </Button>
                      )}
                      {loan.status !== "defaulted" && (
                        <Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate("defaulted")}>
                          <XCircle size={14} className="mr-1" /> Mark Defaulted
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Loan Management */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Loan Management</CardTitle>
                      <CardDescription>Modify loan terms or undo actions</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setIsRestructureOpen(true)}>
                        <RefreshCw size={14} className="mr-1" /> Restructure Loan
                      </Button>
                      {(loan.status === "disbursed" || loan.status === "active") && paidRepayments.length === 0 && (
                        <Button size="sm" variant="destructive" onClick={() => setIsUndoDisbursementOpen(true)}>
                          <Undo2 size={14} className="mr-1" /> Undo Disbursement
                        </Button>
                      )}
                      {(!repayments || repayments.length === 0) && (
                        <Button size="sm" onClick={() => setIsGenerateScheduleOpen(true)}>
                          <Plus size={14} className="mr-1" /> Generate Schedule
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Admin Notes */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare size={16} /> Admin Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add internal notes about this loan..."
                      rows={4}
                    />
                    <Button 
                      size="sm" 
                      onClick={() => saveNotesMutation.mutate()}
                      disabled={saveNotesMutation.isPending}
                    >
                      {saveNotesMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                      Save Notes
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="m-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Collection Activities</CardTitle>
                    <CardDescription>History of follow-up actions for this loan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {collectionActivities && collectionActivities.length > 0 ? (
                      <div className="space-y-3">
                        {collectionActivities.map((activity: any) => (
                          <div key={activity.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                            <div className="flex justify-between items-start">
                              <div>
                                <Badge variant="outline" className="capitalize mb-1">
                                  {activity.activity_type?.replace("_", " ")}
                                </Badge>
                                <p className="text-sm text-muted-foreground">{activity.notes}</p>
                                {activity.outcome && (
                                  <p className="text-xs mt-1"><strong>Outcome:</strong> {activity.outcome}</p>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(activity.created_at), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-6">No collection activities recorded</p>
                    )}
                  </CardContent>
                </Card>

                {/* Disbursement Info */}
                {disbursement && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Disbursement Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-medium">K{Number(disbursement.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Method</p>
                        <p className="font-medium capitalize">{disbursement.disbursement_method?.replace("_", " ")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        {getStatusBadge(disbursement.status)}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Disbursed At</p>
                        <p className="font-medium">
                          {disbursement.disbursed_at ? format(new Date(disbursement.disbursed_at), "MMM dd, yyyy HH:mm") : "Pending"}
                        </p>
                      </div>
                      {disbursement.transaction_reference && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Transaction Reference</p>
                          <p className="font-medium">{disbursement.transaction_reference}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={20} /> Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a payment for installment #{selectedRepayment?.installment_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Due Amount</p>
              <p className="text-xl font-bold">K{Number(selectedRepayment?.amount || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Due: {selectedRepayment?.due_date ? format(new Date(selectedRepayment.due_date), "MMM dd, yyyy") : ""}</p>
            </div>
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={selectedRepayment?.amount.toString()}
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
                  <SelectItem value="deduction">Salary Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference (Optional)</Label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g., Receipt #, Transaction ID"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
              <Button onClick={() => recordPaymentMutation.mutate()} disabled={recordPaymentMutation.isPending}>
                {recordPaymentMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <CheckCircle size={14} className="mr-1" />}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restructure Dialog */}
      <Dialog open={isRestructureOpen} onOpenChange={setIsRestructureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={20} /> Restructure Loan
            </DialogTitle>
            <DialogDescription>
              Modify the loan terms. This will regenerate the pending repayment schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Term (Months)</Label>
                <Input
                  type="number"
                  value={newTermMonths}
                  onChange={(e) => setNewTermMonths(e.target.value)}
                  placeholder={loan.loan_term_months.toString()}
                />
              </div>
              <div className="space-y-2">
                <Label>New Interest Rate (%)</Label>
                <Input
                  type="number"
                  value={newInterestRate}
                  onChange={(e) => setNewInterestRate(e.target.value)}
                  placeholder={loan.interest_rate.toString()}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason for Restructuring *</Label>
              <Textarea
                value={restructureReason}
                onChange={(e) => setRestructureReason(e.target.value)}
                placeholder="Explain why this loan is being restructured..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsRestructureOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => restructureLoanMutation.mutate()} 
                disabled={restructureLoanMutation.isPending || !restructureReason}
              >
                {restructureLoanMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : <RefreshCw size={14} className="mr-1" />}
                Restructure Loan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Schedule Confirmation */}
      <AlertDialog open={isGenerateScheduleOpen} onOpenChange={setIsGenerateScheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Repayment Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a repayment schedule of {loan.loan_term_months} monthly installments of K{Number(loan.monthly_payment || loan.total_repayment / loan.loan_term_months).toLocaleString()} each.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateScheduleMutation.mutate()}>
              {generateScheduleMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Disbursement Confirmation */}
      <AlertDialog open={isUndoDisbursementOpen} onOpenChange={setIsUndoDisbursementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Undo Disbursement</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the disbursement record and all repayment schedules. The loan will be reverted to "Approved" status. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => undoDisbursementMutation.mutate()}
            >
              {undoDisbursementMutation.isPending ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Undo Disbursement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
