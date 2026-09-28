import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@phinduloans/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@phinduloans/shared/components/ui/dialog";
import { useHouseLoans } from "@/hooks/useHouseData";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { houseStageReview, houseSetLoanStatus } from "@/services/repositories/houseWorkflowRepository";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Eye, FileText, Clock } from "lucide-react";

export default function HouseReviewPage() {
  const { productCode = "" } = useParams<{ productCode: string }>();
  const { data: loans } = useHouseLoans(productCode);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canOfficerApprove = can("house", "review_officer_approve");
  const canFinanceApprove = can("house", "review_finance_approve");
  const canManagerApprove = can("house", "review_manager_approve");
  const canReject = canOfficerApprove || canFinanceApprove || canManagerApprove;

  const [rejectLoanId, setRejectLoanId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reviewable = (loans ?? []).filter((l: any) =>
    ["pending", "under_review"].includes(l.status)
  );

  const recentlyReviewed = (loans ?? []).filter((l: any) =>
    ["approved", "rejected", "contract_signing", "awaiting_disbursement"].includes(l.status)
  ).slice(0, 10);

  const stageMutation = useMutation({
    mutationFn: ({ loanId, stage }: { loanId: string; stage: "loan_officer" | "finance" | "manager" }) =>
      houseStageReview(loanId, stage),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "✅ Review stage recorded" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectLoanId) throw new Error("No loan selected");
      if (!rejectReason.trim()) throw new Error("Rejection reason is required");
      await houseSetLoanStatus(rejectLoanId, "rejected");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["house-loans", productCode] });
      toast({ title: "Loan rejected" });
      setRejectLoanId(null);
      setRejectReason("");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const stageLabel = (loan: any) => {
    const psd = loan.product_specific_data;
    if (!psd?.approvals) return "Awaiting review";
    const { loan_officer, finance, manager } = psd.approvals;
    if (manager?.status === "approved") return "Fully approved";
    if (finance?.status === "approved") return "Finance approved";
    if (loan_officer?.status === "approved") return "Officer approved";
    return "Awaiting review";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Review Queue</h2>
          <p className="text-sm text-muted-foreground">{reviewable.length} application(s) pending review</p>
        </div>
      </div>

      {/* Pending review table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={16} /> Pending Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Borrower</TableHead>
                <TableHead>Phone / NRC</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewable.map((loan: any) => (
                <TableRow key={loan.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{loan.full_name || loan.email}</p>
                      <p className="text-xs text-muted-foreground">{loan.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <p>{loan.phone || "—"}</p>
                      <p className="text-xs text-muted-foreground">{loan.nrc_number || ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">K{Number(loan.loan_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{loan.loan_term_months} {loan.term_unit || "months"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{stageLabel(loan)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {loan.created_at ? format(new Date(loan.created_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {canOfficerApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={stageMutation.isPending}
                          onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "loan_officer" })}
                        >
                          <FileText size={12} className="mr-1" /> Verify docs
                        </Button>
                      )}
                      {canFinanceApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={stageMutation.isPending}
                          onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "finance" })}
                        >
                          Finance
                        </Button>
                      )}
                      {canManagerApprove && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={stageMutation.isPending}
                          onClick={() => stageMutation.mutate({ loanId: loan.id, stage: "manager" })}
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Approve
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => { setRejectLoanId(loan.id); setRejectReason(""); }}
                        >
                          <XCircle size={12} className="mr-1" /> Reject
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                        <Link to={`/admin/houses/${productCode}/loans/${loan.id}`}>
                          <Eye size={12} />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {reviewable.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No applications pending review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recently reviewed */}
      {recentlyReviewed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentlyReviewed.map((loan: any) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium text-sm">{loan.full_name || loan.email}</TableCell>
                    <TableCell className="text-right">K{Number(loan.loan_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={loan.status === "rejected" ? "destructive" : "default"}
                        className="text-xs"
                      >
                        {loan.status?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {loan.approved_at ? format(new Date(loan.approved_at), "dd MMM yyyy") : loan.reviewed_at ? format(new Date(loan.reviewed_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/admin/houses/${productCode}/loans/${loan.id}`}><Eye size={14} /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectLoanId} onOpenChange={(open) => { if (!open) setRejectLoanId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this loan application.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectLoanId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
