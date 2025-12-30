import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, CheckCircle, XCircle, RefreshCw, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CRBCheckModuleProps {
  applicationId: string;
  borrowerId: string;
  nrcNumber: string;
  fullName: string;
  dateOfBirth?: string;
  consentObtained: boolean;
  productCrbRequired?: boolean;
}

export const CRBCheckModule = ({
  applicationId,
  borrowerId,
  nrcNumber,
  fullName,
  dateOfBirth,
  consentObtained,
  productCrbRequired = false,
}: CRBCheckModuleProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConsentDialog, setShowConsentDialog] = useState(false);

  // Fetch existing CRB check for this application
  const { data: crbCheck, isLoading } = useQuery({
    queryKey: ["crb-check", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crb_requests")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("request_type", "credit_check")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const performCrbCheck = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("crb-check", {
        body: {
          borrower_id: borrowerId,
          loan_application_id: applicationId,
          nrc_number: nrcNumber,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          consent_obtained: true,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["crb-check", applicationId] });
      toast({
        title: "CRB Check Complete",
        description: `Credit score: ${data.credit_score} - ${data.recommendation?.replace("_", " ")}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "CRB Check Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCrbCheck = () => {
    if (!consentObtained) {
      setShowConsentDialog(true);
      return;
    }
    performCrbCheck.mutate();
  };

  const getScoreColor = (score: number) => {
    if (score >= 600) return "text-green-600";
    if (score >= 400) return "text-yellow-600";
    return "text-red-600";
  };

  const getRatingBadge = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case "good":
        return <Badge className="bg-green-500">Good</Badge>;
      case "fair":
        return <Badge className="bg-yellow-500">Fair</Badge>;
      case "poor":
        return <Badge variant="destructive">Poor</Badge>;
      default:
        return <Badge variant="secondary">Unrated</Badge>;
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case "auto_approve":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "auto_decline":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
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
          <Shield className="h-5 w-5" />
          CRB Credit Check
          {productCrbRequired && (
            <Badge variant="outline" className="ml-2">Required</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {crbCheck ? (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={crbCheck.status === "success" ? "default" : "destructive"}>
                {crbCheck.status === "success" ? "Completed" : crbCheck.status}
              </Badge>
            </div>

            {crbCheck.status === "success" && (
              <>
                {/* Credit Score */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Credit Score</span>
                  <span className={`text-2xl font-bold ${getScoreColor(crbCheck.credit_score || 0)}`}>
                    {crbCheck.credit_score || "N/A"}
                  </span>
                </div>

                {/* Risk Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Risk Rating</span>
                  {getRatingBadge(crbCheck.risk_rating || "")}
                </div>

                {/* Blacklist Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Blacklist Status</span>
                  {crbCheck.blacklist_flag ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Blacklisted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Clear
                    </Badge>
                  )}
                </div>

                {/* Recommendation */}
                {crbCheck.response_payload && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Recommendation</span>
                    <div className="flex items-center gap-2">
                      {getRecommendationIcon((crbCheck.response_payload as any).recommendation)}
                      <span className="capitalize">
                        {((crbCheck.response_payload as any).recommendation || "manual_review").replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Check Date */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <span>Checked on</span>
                  <span>{new Date(crbCheck.created_at || "").toLocaleString()}</span>
                </div>
              </>
            )}

            {crbCheck.status === "failed" && (
              <div className="p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive">{crbCheck.error_message || "CRB check failed"}</p>
              </div>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => performCrbCheck.mutate()}
              disabled={performCrbCheck.isPending}
            >
              {performCrbCheck.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh CRB Check
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No CRB check has been performed yet
              </p>
            </div>

            {!consentObtained && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Borrower consent is required before performing CRB check
                </p>
              </div>
            )}

            <AlertDialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full"
                  onClick={handleCrbCheck}
                  disabled={performCrbCheck.isPending}
                >
                  {performCrbCheck.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Perform CRB Check
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Consent Required</AlertDialogTitle>
                  <AlertDialogDescription>
                    Borrower consent has not been recorded for CRB checks. 
                    Please ensure verbal or written consent is obtained before proceeding.
                    This action will be logged for compliance purposes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => performCrbCheck.mutate()}>
                    Proceed with Consent
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
