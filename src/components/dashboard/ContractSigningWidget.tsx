import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, CheckCircle, Download, PenTool, Loader2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SignaturePad from "@/components/common/SignaturePad";
import { downloadLoanContract } from "@/utils/generateLoanContract";

interface Loan {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  loan_amount: number;
  loan_term_months: number;
  interest_rate: number;
  monthly_payment: number;
  total_repayment: number;
  status: string;
  signed_contract_url: string | null;
  signed_contract_uploaded_at: string | null;
  contract_url: string | null;
}

interface Props {
  userId: string;
}

export default function ContractSigningWidget({ userId }: Props) {
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const queryClient = useQueryClient();

  // Fetch approved loans awaiting contract signing
  const { data: loansAwaitingSignature, isLoading } = useQuery({
    queryKey: ["loans-awaiting-signature", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["approved", "contract_signing"])
        .is("signed_contract_url", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loan[];
    },
    enabled: !!userId,
  });

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLoan || !signatureData) throw new Error("Missing loan or signature");

      // Upload signature image
      const signatureBlob = await fetch(signatureData).then(r => r.blob());
      const fileName = `${userId}/signature_${selectedLoan.id}_${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, signatureBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Update loan with signed contract reference
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          signed_contract_url: fileName,
          signed_contract_uploaded_at: new Date().toISOString(),
          borrower_signed: true,
          borrower_signed_at: new Date().toISOString(),
        })
        .eq("id", selectedLoan.id);

      if (updateError) throw updateError;

      // Notify admin via edge function
      const { error: notifyError } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "admin_contract_signed",
          loanId: selectedLoan.id,
          borrowerName: selectedLoan.full_name,
          borrowerPhone: selectedLoan.phone,
          borrowerEmail: selectedLoan.email,
          loanAmount: selectedLoan.loan_amount,
          signatureUrl: fileName,
        },
      });

      if (notifyError) {
        console.error("Failed to notify admin:", notifyError);
        // Don't throw - notification failure shouldn't block the signing
      }

      return { loanId: selectedLoan.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans-awaiting-signature", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-loans", userId] });
      toast.success("Contract signed successfully! The admin has been notified.");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sign contract");
    },
  });

  const handleSignatureCapture = (data: string, file?: File) => {
    setSignatureData(data);
    setSignatureFile(file || null);
  };

  const handleOpenSignDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsSignDialogOpen(true);
    setSignatureData(null);
    setAgreedToTerms(false);
  };

  const handleCloseDialog = () => {
    setIsSignDialogOpen(false);
    setSelectedLoan(null);
    setSignatureData(null);
    setSignatureFile(null);
    setAgreedToTerms(false);
  };

  const handleDownloadContract = async (loan: Loan) => {
    await downloadLoanContract({
      id: loan.id,
      full_name: loan.full_name,
      email: loan.email,
      phone: loan.phone,
      loan_amount: loan.loan_amount,
      loan_term_months: loan.loan_term_months,
      interest_rate: loan.interest_rate,
      monthly_payment: loan.monthly_payment,
      total_repayment: loan.total_repayment,
    } as any);
    toast.success("Contract downloaded");
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!loansAwaitingSignature || loansAwaitingSignature.length === 0) {
    return null; // Don't show widget if no contracts to sign
  }

  return (
    <>
      <Card className="glass border-warning/50 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool size={18} className="text-warning" />
            Contracts Awaiting Signature
          </CardTitle>
          <CardDescription>
            Sign your approved loan contracts to proceed with disbursement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loansAwaitingSignature.map((loan) => (
            <div
              key={loan.id}
              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <FileText className="text-warning" size={20} />
                </div>
                <div>
                  <p className="font-medium">Loan Contract</p>
                  <p className="text-sm text-muted-foreground">
                    K{loan.loan_amount.toLocaleString()} • {loan.loan_term_months} months
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadContract(loan)}
                >
                  <Download size={14} className="mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenSignDialog(loan)}
                >
                  <PenTool size={14} className="mr-1" />
                  Sign
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Signing Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="text-primary" />
              Sign Loan Contract
            </DialogTitle>
            <DialogDescription>
              Review and sign your loan contract to proceed with disbursement
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-6">
              {/* Loan Summary */}
              <Card className="bg-secondary/30">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3">Loan Summary</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Loan Amount</p>
                      <p className="font-medium">K{selectedLoan.loan_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="font-medium">K{selectedLoan.monthly_payment.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Term</p>
                      <p className="font-medium">{selectedLoan.loan_term_months} months</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Repayment</p>
                      <p className="font-medium">K{selectedLoan.total_repayment.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contract Download */}
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Download and review the full contract before signing</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadContract(selectedLoan)}
                  >
                    <Download size={14} className="mr-1" />
                    Download PDF
                  </Button>
                </AlertDescription>
              </Alert>

              {/* Signature Capture */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Your Signature</Label>
                <SignaturePad
                  onSave={handleSignatureCapture}
                  disabled={signContractMutation.isPending}
                />
                {signatureData && (
                  <div className="mt-3 flex items-center gap-2 text-success text-sm">
                    <CheckCircle size={16} />
                    Signature captured
                  </div>
                )}
              </div>

              {/* Terms Agreement */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  disabled={signContractMutation.isPending}
                />
                <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                  I have read and understood the loan contract. I agree to the terms and conditions
                  and authorize Phindu Credit Solutions Limited to proceed with the loan disbursement.
                </Label>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={() => signContractMutation.mutate()}
                  disabled={!signatureData || !agreedToTerms || signContractMutation.isPending}
                >
                  {signContractMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
                      Signing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="mr-2" />
                      Submit Signed Contract
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
