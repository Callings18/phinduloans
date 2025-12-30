import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, CheckCircle, XCircle, AlertTriangle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface GuaranteeCheckModuleProps {
  applicationId: string;
  borrowerId: string;
  borrowerNrc: string;
  borrowerName: string;
  employerName?: string;
  monthlyIncome?: number;
  loanAmount: number;
  loanTermMonths: number;
  guaranteeProvider?: string;
  guaranteeRequired?: boolean;
}

export const GuaranteeCheckModule = ({
  applicationId,
  borrowerId,
  borrowerNrc,
  borrowerName,
  employerName,
  monthlyIncome,
  loanAmount,
  loanTermMonths,
  guaranteeProvider = "pmic",
  guaranteeRequired = false,
}: GuaranteeCheckModuleProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [manualReferenceCode, setManualReferenceCode] = useState("");

  // Fetch existing guarantee for this loan
  const { data: guarantee, isLoading } = useQuery({
    queryKey: ["guarantee", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guarantees")
        .select("*")
        .eq("loan_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const checkGuarantee = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("guarantee-check", {
        body: {
          loan_id: applicationId,
          borrower_id: borrowerId,
          loan_amount: loanAmount,
          loan_term_months: loanTermMonths,
          borrower_nrc: borrowerNrc,
          borrower_name: borrowerName,
          employer_name: employerName,
          monthly_income: monthlyIncome,
          guarantee_provider: guaranteeProvider,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["guarantee", applicationId] });
      toast({
        title: data.success ? "Guarantee Approved" : "Guarantee Check Complete",
        description: data.message || `Status: ${data.status}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Guarantee Check Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyOverride = useMutation({
    mutationFn: async () => {
      if (!overrideReason.trim()) {
        throw new Error("Override reason is required");
      }

      const { data, error } = await supabase
        .from("guarantees")
        .upsert({
          loan_id: applicationId,
          guarantee_provider: guaranteeProvider,
          status: "approved",
          admin_override: true,
          override_reason: overrideReason,
          reference_code: manualReferenceCode || `MANUAL-${Date.now()}`,
          guaranteed_amount: (loanAmount * 80) / 100,
          guaranteed_percentage: 80,
          approval_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guarantee", applicationId] });
      setShowOverrideDialog(false);
      setOverrideReason("");
      setManualReferenceCode("");
      toast({
        title: "Override Applied",
        description: "Guarantee has been manually approved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Override Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "failed":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "failed":
        return <Badge variant="secondary">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZM", {
      style: "currency",
      currency: "ZMW",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Credit Guarantee ({guaranteeProvider?.toUpperCase()})
          {guaranteeRequired && (
            <Badge variant="outline" className="ml-2">Required</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {guarantee ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(guarantee.status || "")}
                {getStatusBadge(guarantee.status || "")}
              </div>
            </div>

            {/* Reference Code */}
            {guarantee.reference_code && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reference Code</span>
                <code className="bg-muted px-2 py-1 rounded text-sm">
                  {guarantee.reference_code}
                </code>
              </div>
            )}

            {/* Guaranteed Amount */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Guaranteed Amount</span>
              <span className="font-semibold">
                {formatCurrency(guarantee.guaranteed_amount || 0)}
              </span>
            </div>

            {/* Coverage */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coverage</span>
              <span>{guarantee.guaranteed_percentage || 80}%</span>
            </div>

            {/* Fee */}
            {guarantee.guarantee_fee && guarantee.guarantee_fee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Guarantee Fee</span>
                <span>{formatCurrency(guarantee.guarantee_fee)}</span>
              </div>
            )}

            {/* Validity */}
            {guarantee.validity_end && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valid Until</span>
                <span>{new Date(guarantee.validity_end).toLocaleDateString()}</span>
              </div>
            )}

            {/* Override Indicator */}
            {guarantee.admin_override && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                      Manual Override Applied
                    </p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500">
                      {guarantee.override_reason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conditions */}
            {guarantee.conditions && Array.isArray(guarantee.conditions) && (
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-2">Conditions</p>
                <ul className="text-sm space-y-1">
                  {(guarantee.conditions as string[]).map((condition, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      {condition}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions for non-approved status */}
            {guarantee.status !== "approved" && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => checkGuarantee.mutate()}
                  disabled={checkGuarantee.isPending}
                >
                  {checkGuarantee.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Retry Check
                </Button>
                <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="flex-1">
                      Manual Override
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Manual Guarantee Override</DialogTitle>
                      <DialogDescription>
                        Manually approve this loan for credit guarantee coverage. 
                        This action will be logged for audit purposes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Reference Code (Optional)</Label>
                        <Input
                          placeholder="Enter PMIC reference if available"
                          value={manualReferenceCode}
                          onChange={(e) => setManualReferenceCode(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Override Reason *</Label>
                        <Textarea
                          placeholder="Explain why manual approval is being granted..."
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => applyOverride.mutate()}
                        disabled={!overrideReason.trim() || applyOverride.isPending}
                      >
                        {applyOverride.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Approve Override
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No guarantee check has been performed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Estimated coverage: {formatCurrency(loanAmount * 0.8)} (80%)
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => checkGuarantee.mutate()}
              disabled={checkGuarantee.isPending}
            >
              {checkGuarantee.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Check Guarantee Eligibility
            </Button>

            <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Enter Manual Reference
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manual Guarantee Entry</DialogTitle>
                  <DialogDescription>
                    Enter guarantee reference code if obtained offline from {guaranteeProvider?.toUpperCase()}.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Reference Code *</Label>
                    <Input
                      placeholder="Enter PMIC/ZCGS reference code"
                      value={manualReferenceCode}
                      onChange={(e) => setManualReferenceCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional notes about the guarantee..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => applyOverride.mutate()}
                    disabled={!manualReferenceCode.trim() || applyOverride.isPending}
                  >
                    {applyOverride.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Save Reference
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
