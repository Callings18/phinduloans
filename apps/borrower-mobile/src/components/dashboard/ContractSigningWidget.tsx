import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@phinduloans/shared/components/ui/dialog";
import { Alert, AlertDescription } from "@phinduloans/shared/components/ui/alert";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Checkbox } from "@phinduloans/shared/components/ui/checkbox";
import { Label } from "@phinduloans/shared/components/ui/label";
import { FileText, CheckCircle, Download, PenTool, Loader2, AlertTriangle, Clock, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SignaturePad from "@phinduloans/shared/components/common/SignaturePad";
import { validateBorrowerContractUploadFile } from "@phinduloans/shared/utils/borrowerUploadValidation";
import { downloadLoanContract, generateSignedContractPDF } from "@phinduloans/shared/utils/generateLoanContract";
import { logAudit } from "@phinduloans/shared/utils/auditLog";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@phinduloans/shared/components/ui/tabs";
import { borrowerSignContract } from "@phinduloans/shared/services/repositories/coreWritesRepository";

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
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [uploadedContractFile, setUploadedContractFile] = useState<File | null>(null);
  const [signingMethod, setSigningMethod] = useState<"draw" | "upload">("draw");
  const queryClient = useQueryClient();

  // Loans awaiting borrower signature
  const { data: loansAwaitingSignature, isLoading } = useQuery({
    queryKey: ["loans-awaiting-signature", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["approved", "contract_signing", "awaiting_disbursement"])
        .eq("borrower_signed", false)
        .is("signed_contract_url", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Loan[];
    },
    enabled: !!userId,
  });

  const { data: signedContracts = [] } = useQuery({
    queryKey: ["borrower-signed-contracts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, loan_term_months, signed_contract_url, borrower_signed_at, status")
        .eq("user_id", userId)
        .eq("borrower_signed", true)
        .not("signed_contract_url", "is", null)
        .order("borrower_signed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLoan || !signatureData) throw new Error("Missing loan or signature");

      // Upload raw signature image
      const signatureBlob = await fetch(signatureData).then(r => r.blob());
      const sigFileName = `${userId}/signature_${selectedLoan.id}_${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(sigFileName, signatureBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Generate signed contract PDF with signature embedded
      const signedPdfPath = await generateSignedContractPDF(
        {
          id: selectedLoan.id,
          full_name: selectedLoan.full_name,
          email: selectedLoan.email,
          phone: selectedLoan.phone,
          loan_amount: selectedLoan.loan_amount,
          loan_term_months: selectedLoan.loan_term_months,
          interest_rate: selectedLoan.interest_rate,
          monthly_payment: selectedLoan.monthly_payment,
          total_repayment: selectedLoan.total_repayment,
          loan_purpose: '',
          nrc_number: '',
          monthly_income: 0,
          created_at: '',
        } as any,
        signatureData,
        new Date().toISOString(),
      );

      const signedPath = signedPdfPath || sigFileName;
      await borrowerSignContract(selectedLoan.id, signedPath);

      await logAudit({
        action: 'CONTRACT_SIGNED_BORROWER',
        entity_type: 'loan_application',
        entity_id: selectedLoan.id,
      });

      // Notify admin via edge function
      const { error: notifyError } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "admin_contract_signed",
          loanId: selectedLoan.id,
          borrowerName: selectedLoan.full_name,
          borrowerPhone: selectedLoan.phone,
          borrowerEmail: selectedLoan.email,
          loanAmount: selectedLoan.loan_amount,
          signatureUrl: signedPath,
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
      queryClient.invalidateQueries({ queryKey: ["borrower-signed-contracts", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-loans", userId] });
      toast.success("Contract signed successfully! Your application is now awaiting disbursement.");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sign contract");
    },
  });

  // Upload signed contract mutation
  const uploadContractMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLoan || !uploadedContractFile) throw new Error("Missing loan or file");
      const uploadErr = validateBorrowerContractUploadFile(uploadedContractFile);
      if (uploadErr) throw new Error(uploadErr);

      const fileExt = uploadedContractFile.name.split('.').pop();
      const fileName = `${userId}/signed_contract_${selectedLoan.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("loan-documents")
        .upload(fileName, uploadedContractFile, {
          contentType: uploadedContractFile.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      await borrowerSignContract(selectedLoan.id, fileName);

      // Notify admin
      await supabase.functions.invoke("send-notification", {
        body: {
          type: "admin_contract_signed",
          loanId: selectedLoan.id,
          borrowerName: selectedLoan.full_name,
          borrowerPhone: selectedLoan.phone,
          borrowerEmail: selectedLoan.email,
          loanAmount: selectedLoan.loan_amount,
          signatureUrl: fileName,
        },
      }).catch(err => console.error("Failed to notify admin:", err));

      return { loanId: selectedLoan.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans-awaiting-signature", userId] });
      queryClient.invalidateQueries({ queryKey: ["borrower-signed-contracts", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-loans", userId] });
      toast.success("Signed contract uploaded! Your application is now awaiting disbursement.");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload signed contract");
    },
  });

  const handleSignatureCapture = (data: string, _file?: File) => {
    setSignatureData(data);
  };

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedContractFile(null);
      return;
    }
    const err = validateBorrowerContractUploadFile(file);
    if (err) {
      toast.error(err);
      e.target.value = "";
      setUploadedContractFile(null);
      return;
    }
    setUploadedContractFile(file);
  };

  const handleOpenSignDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsSignDialogOpen(true);
    setSignatureData(null);
    setAgreedToTerms(false);
    setUploadedContractFile(null);
    setSigningMethod("draw");
  };

  const handleCloseDialog = () => {
    setIsSignDialogOpen(false);
    setSelectedLoan(null);
    setSignatureData(null);
    setAgreedToTerms(false);
    setUploadedContractFile(null);
    setSigningMethod("draw");
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
      contract_url: loan.contract_url,
    } as any);
    toast.success("Contract downloaded");
  };

  const handleViewSignedContract = async (signedUrl: string) => {
    const { data, error } = await supabase.storage.from("loan-documents").createSignedUrl(signedUrl, 300);
    if (error || !data?.signedUrl) {
      toast.error("Could not open signed contract");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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

  if ((!loansAwaitingSignature || loansAwaitingSignature.length === 0) && signedContracts.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={18} className="text-muted-foreground" />
            Contract Signing
          </CardTitle>
          <CardDescription>
            No contracts are awaiting your signature right now.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={18} className="text-muted-foreground" />
            Loan Contract
          </CardTitle>
          <CardDescription>
            Review, download, and sign your loan contract to proceed with disbursement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loansAwaitingSignature.map((loan) => (
            <div
              key={loan.id}
              className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="text-muted-foreground" size={20} />
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
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenSignDialog(loan)}
                >
                  <Upload size={14} className="mr-1" />
                  Upload Signed Copy
                </Button>
              </div>
            </div>
          ))}
          {signedContracts.map((loan) => (
            <div
              key={loan.id}
              className="flex items-center justify-between p-3 bg-success/5 rounded-lg border border-success/20"
            >
              <div>
                <p className="font-medium text-sm">Signed contract</p>
                <p className="text-xs text-muted-foreground">
                  K{Number(loan.loan_amount).toLocaleString()} •{" "}
                  {loan.borrower_signed_at ? format(new Date(loan.borrower_signed_at), "MMM d, yyyy") : "Signed"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loan.signed_contract_url && handleViewSignedContract(loan.signed_contract_url)}
              >
                <Download size={14} className="mr-1" />
                View signed
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Signing Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="text-primary" />
              Sign Loan Contract
            </DialogTitle>
            <DialogDescription>
              Download and review your contract, then sign digitally or upload a signed copy.
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

              {/* Signature Capture - Draw or Upload */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Sign Your Contract</Label>
                <Tabs value={signingMethod} onValueChange={(v) => setSigningMethod(v as "draw" | "upload")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="draw" className="flex items-center gap-2">
                      <PenTool size={14} />
                      Sign Digitally
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload size={14} />
                      Upload Signed Copy
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="draw" className="mt-4">
                    <div className="bg-white rounded-lg p-2">
                      <SignaturePad
                        onSave={handleSignatureCapture}
                        disabled={signContractMutation.isPending}
                      />
                    </div>
                    {signatureData && (
                      <div className="mt-3 flex items-center gap-2 text-success text-sm">
                        <CheckCircle size={16} />
                        Signature captured
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="upload" className="mt-4 space-y-4">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload your signed contract (PDF, JPG, PNG)
                      </p>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleContractFileChange}
                        disabled={uploadContractMutation.isPending}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                    {uploadedContractFile && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckCircle size={16} />
                        File selected: {uploadedContractFile.name}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Terms Agreement */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  disabled={signContractMutation.isPending || uploadContractMutation.isPending}
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
                {signingMethod === "draw" ? (
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
                ) : (
                  <Button
                    onClick={() => uploadContractMutation.mutate()}
                    disabled={!uploadedContractFile || !agreedToTerms || uploadContractMutation.isPending}
                  >
                    {uploadContractMutation.isPending ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="mr-2" />
                        Upload Signed Contract
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
