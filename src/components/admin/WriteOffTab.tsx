import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  Loader2,
  XCircle,
  Award,
  Banknote,
  Calendar,
  Clock,
  RefreshCw,
} from "lucide-react";
import { generateClearanceCertificate, downloadClearanceCertificate } from "@/utils/generateClearanceCertificate";

interface Loan {
  id: string;
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
  status: string;
  created_at: string;
  settlement_date?: string | null;
  settlement_type?: string | null;
}

interface WriteOffTabProps {
  loan: Loan;
  totalPaid: number;
  totalPending: number;
}

export default function WriteOffTab({ loan, totalPaid, totalPending }: WriteOffTabProps) {
  const [isWriteOffOpen, setIsWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writeOffAmount, setWriteOffAmount] = useState(totalPending.toString());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [recoveryNotes, setRecoveryNotes] = useState("");

  const queryClient = useQueryClient();

  // Fetch existing write-off
  const { data: writeOff, isLoading } = useQuery({
    queryKey: ["loan-writeoff", loan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_writeoffs")
        .select("*")
        .eq("loan_id", loan.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Create write-off mutation
  const createWriteOffMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_writeoffs").insert({
        loan_id: loan.id,
        writeoff_amount: Number(writeOffAmount),
        reason: writeOffReason,
        status: "pending",
      });

      if (error) throw error;

      // Log collection activity
      await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "writeoff_initiated",
        notes: `Write-off initiated for K${Number(writeOffAmount).toLocaleString()}. Reason: ${writeOffReason}`,
        outcome: "Pending approval",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-writeoff", loan.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-collection-activities", loan.id] });
      toast.success("Write-off request submitted for approval");
      setIsWriteOffOpen(false);
      setWriteOffReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create write-off");
    },
  });

  // Approve write-off mutation
  const approveWriteOffMutation = useMutation({
    mutationFn: async () => {
      const { error: writeOffError } = await supabase
        .from("loan_writeoffs")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", writeOff?.id);

      if (writeOffError) throw writeOffError;

      // Update loan status to defaulted
      const { error: loanError } = await supabase
        .from("loan_applications")
        .update({ status: "defaulted" })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // Log activity
      await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "writeoff_approved",
        notes: `Write-off approved. Amount: K${Number(writeOff?.writeoff_amount || 0).toLocaleString()}`,
        outcome: "Loan written off",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-writeoff", loan.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-active-loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-collection-activities", loan.id] });
      toast.success("Write-off approved - loan marked as defaulted");
      setIsConfirmOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve write-off");
    },
  });

  // Record recovery mutation
  const recordRecoveryMutation = useMutation({
    mutationFn: async () => {
      if (!writeOff) throw new Error("No write-off found");

      const newRecoveryAmount = (writeOff.recovery_amount || 0) + Number(recoveryAmount);

      const { error } = await supabase
        .from("loan_writeoffs")
        .update({
          recovery_amount: newRecoveryAmount,
          recovery_notes: `${writeOff.recovery_notes || ""}\n[${format(new Date(), "yyyy-MM-dd")}] Recovered K${Number(recoveryAmount).toLocaleString()}: ${recoveryNotes}`.trim(),
        })
        .eq("id", writeOff.id);

      if (error) throw error;

      // Log activity
      await supabase.from("collection_activities").insert({
        loan_id: loan.id,
        activity_type: "recovery_recorded",
        notes: `Recovery recorded: K${Number(recoveryAmount).toLocaleString()}. ${recoveryNotes}`,
        outcome: `Total recovered: K${newRecoveryAmount.toLocaleString()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-writeoff", loan.id] });
      queryClient.invalidateQueries({ queryKey: ["loan-collection-activities", loan.id] });
      toast.success("Recovery recorded successfully");
      setIsRecoveryOpen(false);
      setRecoveryAmount("");
      setRecoveryNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record recovery");
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      pending: { color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
      approved: { color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
      rejected: { color: "bg-muted text-muted-foreground border-muted", icon: RefreshCw },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // If loan is completed, show clearance certificate options
  if (loan.status === "completed") {
    return (
      <div className="space-y-6">
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-success/20">
                <Award className="text-success" size={24} />
              </div>
              <div>
                <CardTitle className="text-success">Loan Completed</CardTitle>
                <CardDescription>
                  This loan has been fully repaid{loan.settlement_date && ` on ${format(new Date(loan.settlement_date), "MMMM dd, yyyy")}`}
                  {loan.settlement_type === "early" && " (Early Settlement)"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Principal</p>
                <p className="text-lg font-bold">K{loan.loan_amount.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Total Repaid</p>
                <p className="text-lg font-bold text-success">K{loan.total_repayment.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Loan Term</p>
                <p className="text-lg font-bold">{loan.loan_term_months} months</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className="bg-success/20 text-success border-success/30 mt-1">
                  <CheckCircle size={12} className="mr-1" /> Cleared
                </Badge>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileText size={18} /> Clearance Certificate
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Generate an official clearance certificate confirming that this borrower has fully repaid their loan obligations.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => generateClearanceCertificate(loan)}>
                  <FileText size={14} className="mr-2" /> View Certificate
                </Button>
                <Button variant="outline" onClick={() => downloadClearanceCertificate(loan)}>
                  <Download size={14} className="mr-2" /> Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If there's an existing write-off
  if (writeOff) {
    return (
      <div className="space-y-6">
        <Card className={writeOff.status === "approved" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full ${writeOff.status === "approved" ? "bg-destructive/20" : "bg-warning/20"}`}>
                  <XCircle className={writeOff.status === "approved" ? "text-destructive" : "text-warning"} size={24} />
                </div>
                <div>
                  <CardTitle>Loan Write-Off</CardTitle>
                  <CardDescription>
                    Initiated on {format(new Date(writeOff.created_at), "MMMM dd, yyyy")}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(writeOff.status || "pending")}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Write-Off Amount</p>
                <p className="text-lg font-bold text-destructive">K{Number(writeOff.writeoff_amount).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="text-lg font-bold text-success">K{totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Total Recovered</p>
                <p className="text-lg font-bold text-info">K{Number(writeOff.recovery_amount || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-xs text-muted-foreground">Net Loss</p>
                <p className="text-lg font-bold">
                  K{(Number(writeOff.writeoff_amount) - Number(writeOff.recovery_amount || 0)).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-background border border-border">
              <p className="text-sm font-medium mb-1">Reason for Write-Off</p>
              <p className="text-sm text-muted-foreground">{writeOff.reason}</p>
            </div>

            {writeOff.recovery_notes && (
              <div className="p-4 rounded-lg bg-background border border-border">
                <p className="text-sm font-medium mb-1">Recovery Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{writeOff.recovery_notes}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {writeOff.status === "pending" && (
                <Button onClick={() => setIsConfirmOpen(true)} variant="destructive">
                  <CheckCircle size={14} className="mr-2" /> Approve Write-Off
                </Button>
              )}
              {writeOff.status === "approved" && (
                <Button onClick={() => setIsRecoveryOpen(true)}>
                  <Banknote size={14} className="mr-2" /> Record Recovery
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Approve Write-Off Confirmation */}
        <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={20} /> Approve Write-Off
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the loan as defaulted and write off K{Number(writeOff.writeoff_amount).toLocaleString()}.
                This action will affect your portfolio at risk metrics. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => approveWriteOffMutation.mutate()}
                disabled={approveWriteOffMutation.isPending}
              >
                {approveWriteOffMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                Approve Write-Off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Record Recovery Dialog */}
        <Dialog open={isRecoveryOpen} onOpenChange={setIsRecoveryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote size={20} /> Record Recovery
              </DialogTitle>
              <DialogDescription>
                Record any amount recovered from this written-off loan
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recovery Amount (K)</Label>
                <Input
                  type="number"
                  value={recoveryAmount}
                  onChange={(e) => setRecoveryAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={recoveryNotes}
                  onChange={(e) => setRecoveryNotes(e.target.value)}
                  placeholder="How was this amount recovered? (e.g., partial payment, asset sale, etc.)"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsRecoveryOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => recordRecoveryMutation.mutate()}
                  disabled={recordRecoveryMutation.isPending || !recoveryAmount || Number(recoveryAmount) <= 0}
                >
                  {recordRecoveryMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                  Record Recovery
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // No write-off exists - show option to initiate
  return (
    <div className="space-y-6">
      {/* Loan Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote size={18} /> Outstanding Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Loan Value</p>
              <p className="text-lg font-bold">K{loan.total_repayment.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10">
              <p className="text-xs text-muted-foreground">Amount Paid</p>
              <p className="text-lg font-bold text-success">K{totalPaid.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-xs text-muted-foreground">Amount Pending</p>
              <p className="text-lg font-bold text-destructive">K{totalPending.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Payment Progress</p>
              <p className="text-lg font-bold">
                {((totalPaid / loan.total_repayment) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Write-Off Section */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="text-destructive" size={24} />
            </div>
            <div>
              <CardTitle>Loan Write-Off</CardTitle>
              <CardDescription>
                Write off this loan if it's deemed unrecoverable
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-destructive mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-destructive">Warning</p>
                <p className="text-sm text-muted-foreground">
                  Writing off a loan will mark it as defaulted and record the outstanding balance as a loss.
                  This action should only be taken when all collection efforts have been exhausted.
                </p>
              </div>
            </div>
          </div>
          <Button variant="destructive" onClick={() => setIsWriteOffOpen(true)}>
            <XCircle size={14} className="mr-2" /> Initiate Write-Off
          </Button>
        </CardContent>
      </Card>

      {/* Clearance Certificate Info */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award size={18} /> Clearance Certificate
          </CardTitle>
          <CardDescription>
            Clearance certificates are only available for fully repaid loans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once this loan is marked as "Completed" (all payments received), you will be able to generate
            an official clearance certificate for the borrower.
          </p>
        </CardContent>
      </Card>

      {/* Write-Off Dialog */}
      <Dialog open={isWriteOffOpen} onOpenChange={setIsWriteOffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle size={20} /> Initiate Loan Write-Off
            </DialogTitle>
            <DialogDescription>
              Submit this loan for write-off approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Borrower</p>
                  <p className="font-medium">{loan.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="font-medium text-destructive">K{totalPending.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Write-Off Amount (K)</Label>
              <Input
                type="number"
                value={writeOffAmount}
                onChange={(e) => setWriteOffAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Typically the outstanding balance: K{totalPending.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reason for Write-Off *</Label>
              <Textarea
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                placeholder="Explain why this loan should be written off (e.g., borrower deceased, bankruptcy, all collection efforts exhausted, etc.)"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsWriteOffOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => createWriteOffMutation.mutate()}
                disabled={createWriteOffMutation.isPending || !writeOffReason || !writeOffAmount}
              >
                {createWriteOffMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                Submit for Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
