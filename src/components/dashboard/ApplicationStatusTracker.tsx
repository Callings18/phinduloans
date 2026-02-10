import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Banknote, 
  Activity,
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface LoanApplication {
  id: string;
  full_name: string;
  loan_amount: number;
  loan_term_months: number;
  status: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
}

const statusSteps = [
  { key: "pending", label: "Submitted", icon: FileText },
  { key: "under_review", label: "Under Review", icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "contract_signing", label: "Contract Signing", icon: FileText },
  { key: "awaiting_disbursement", label: "Awaiting Disbursement", icon: Banknote },
  { key: "disbursed", label: "Disbursed", icon: Banknote },
  { key: "active", label: "Active", icon: Activity },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const getStatusIndex = (status: string): number => {
  if (status === "rejected") return -1;
  if (status === "defaulted") return -1;
  const index = statusSteps.findIndex(s => s.key === status);
  return index >= 0 ? index : 0;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "pending": return "bg-yellow-500";
    case "under_review": return "bg-blue-500";
    case "approved": return "bg-green-500";
    case "contract_signing": return "bg-orange-500";
    case "awaiting_disbursement": return "bg-indigo-500";
    case "rejected": return "bg-red-500";
    case "disbursed": return "bg-purple-500";
    case "active": return "bg-emerald-500";
    case "completed": return "bg-primary";
    case "defaulted": return "bg-destructive";
    default: return "bg-muted";
  }
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "approved":
    case "contract_signing":
    case "awaiting_disbursement":
    case "disbursed":
    case "active":
    case "completed":
      return "default";
    case "rejected":
    case "defaulted":
      return "destructive";
    case "pending":
    case "under_review":
      return "secondary";
    default:
      return "outline";
  }
};

interface ApplicationStatusTrackerProps {
  userId: string;
}

export function ApplicationStatusTracker({ userId }: ApplicationStatusTrackerProps) {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch initial applications
    const fetchApplications = async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, full_name, loan_amount, loan_term_months, status, created_at, updated_at, reviewed_at, rejection_reason, admin_notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching applications:", error);
      } else {
        setApplications(data || []);
      }
      setLoading(false);
    };

    fetchApplications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("loan-status-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loan_applications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedApp = payload.new as LoanApplication;
          setApplications((prev) =>
            prev.map((app) =>
              app.id === updatedApp.id ? { ...app, ...updatedApp } : app
            )
          );
          
          // Show toast notification for status change
          toast({
            title: "Application Status Updated",
            description: `Your loan application status changed to: ${updatedApp.status.replace(/_/g, " ").toUpperCase()}`,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "loan_applications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newApp = payload.new as LoanApplication;
          setApplications((prev) => [newApp, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
          <p className="text-muted-foreground text-center">
            You haven't submitted any loan applications. Start your application to track its progress here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {applications.map((app) => {
        const currentIndex = getStatusIndex(app.status);
        const isRejected = app.status === "rejected";
        const isDefaulted = app.status === "defaulted";
        const progressPercent = isRejected || isDefaulted 
          ? 0 
          : ((currentIndex + 1) / statusSteps.length) * 100;

        return (
          <Card key={app.id} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    K{app.loan_amount.toLocaleString()} Loan
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {app.loan_term_months} months • Applied {format(new Date(app.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(app.status)} className="capitalize">
                  {app.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Bar */}
              {!isRejected && !isDefaulted && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}

              {/* Status Timeline */}
              <div className="relative">
                {isRejected || isDefaulted ? (
                  <div className="flex items-center gap-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <XCircle className="h-8 w-8 text-destructive flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-destructive">
                        {isRejected ? "Application Rejected" : "Loan Defaulted"}
                      </h4>
                      {app.rejection_reason && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Reason: {app.rejection_reason}
                        </p>
                      )}
                      {app.reviewed_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(app.reviewed_at), "MMMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between overflow-x-auto pb-2">
                    {statusSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const isCompleted = index <= currentIndex;
                      const isCurrent = index === currentIndex;

                      return (
                        <div key={step.key} className="flex flex-col items-center min-w-[80px] relative">
                          {/* Connector Line */}
                          {index > 0 && (
                            <div
                              className={cn(
                                "absolute top-5 -left-1/2 w-full h-0.5",
                                index <= currentIndex ? "bg-primary" : "bg-muted"
                              )}
                              style={{ zIndex: 0 }}
                            />
                          )}
                          
                          {/* Icon Circle */}
                          <div
                            className={cn(
                              "relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                              isCurrent && "ring-4 ring-primary/20"
                            )}
                          >
                            <StepIcon className="h-5 w-5" />
                          </div>

                          {/* Label */}
                          <span
                            className={cn(
                              "text-xs mt-2 text-center",
                              isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Current Status Message */}
              {!isRejected && !isDefaulted && (
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium">
                      {app.status === "pending" && "Your application is being processed"}
                      {app.status === "under_review" && "Your application is under review"}
                      {app.status === "approved" && "Congratulations! Your loan is approved"}
                      {app.status === "contract_signing" && "Please sign your contract to proceed"}
                      {app.status === "awaiting_disbursement" && "Contract fully signed — awaiting disbursement"}
                      {app.status === "disbursed" && "Funds have been disbursed to your account"}
                      {app.status === "active" && "Your loan is active"}
                      {app.status === "completed" && "Loan fully repaid"}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {app.status === "pending" && "We'll review your application within 24-48 hours."}
                      {app.status === "under_review" && "Our team is verifying your documents and information."}
                      {app.status === "approved" && "Your contract is being prepared for signing."}
                      {app.status === "contract_signing" && "Sign your loan contract to proceed with disbursement."}
                      {app.status === "awaiting_disbursement" && "Your contract has been signed by both parties. Funds will be released shortly."}
                      {app.status === "disbursed" && "Check your bank account or mobile money for the funds."}
                      {app.status === "active" && "Make timely payments to maintain good standing."}
                      {app.status === "completed" && "Thank you for being a valued customer!"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {format(new Date(app.updated_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
