import { Card, CardContent } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Banknote,
  Calendar,
  Download,
} from "lucide-react";
import { downloadRepaymentReceipt } from "@phinduloans/shared/utils/generateRepaymentReceipt";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@phinduloans/shared/components/ui/table";
import {
  isPaymentClaimApprovedStatus,
  isPaymentClaimPendingStatus,
} from "@phinduloans/shared/constants/paymentClaims";
import { borrowerInstallmentLabel } from "@phinduloans/shared/utils/repaymentFrequencyLabels";
import {
  borrowerCanSubmitPaymentClaim,
  borrowerRepaymentPenaltyDue,
  borrowerRepaymentRemaining,
  borrowerRepaymentStatusDisplay,
  borrowerRepaymentTotalDue,
} from "@phinduloans/shared/utils/borrowerRepaymentDisplay";
import type { BorrowerDashboardLoan } from "@phinduloans/shared/types/borrowerDashboard";

interface Props {
  repayments: any[];
  loans: BorrowerDashboardLoan[];
  paymentClaims: any[];
  onSubmitPayment: (rep: any) => void;
  loadError?: boolean;
}

export default function BorrowerPaymentsTab({ repayments, loans, paymentClaims, onSubmitPayment, loadError = false }: Props) {
  const getRepaymentStatus = (rep: any) => {
    const display = borrowerRepaymentStatusDisplay(rep);
    const icon =
      display.label.startsWith("Paid") ? CheckCircle
      : display.label.startsWith("Cancelled") ? AlertCircle
      : display.isOverdue ? AlertTriangle
      : Clock;
    return { label: display.label, color: display.color, icon };
  };

  const sorted = [...repayments].sort((a, b) => {
    const order = { overdue: 0, partial: 1, pending: 2, paid: 3, cancelled: 4 };
    const aDisplay = borrowerRepaymentStatusDisplay(a);
    const bDisplay = borrowerRepaymentStatusDisplay(b);
    const aKey = aDisplay.isOverdue ? "overdue" : (a.status === "partial" ? "partial" : a.status);
    const bKey = bDisplay.isOverdue ? "overdue" : (b.status === "partial" ? "partial" : b.status);
    const orderDiff = (order[aKey as keyof typeof order] ?? 5) - (order[bKey as keyof typeof order] ?? 5);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const pendingCount = repayments.filter((r) => borrowerCanSubmitPaymentClaim(r)).length;
  const paidCount = repayments.filter((r) => r.status === "paid").length;
  const totalPaid = repayments.reduce((sum, r) => sum + Number(r.principal_paid || (r.status === "paid" ? r.original_amount || r.amount : 0)), 0);
  const overdueAmount = repayments
    .filter((r) => borrowerRepaymentStatusDisplay(r).isOverdue)
    .reduce((sum, r) => sum + borrowerRepaymentTotalDue(r), 0);

  const getLoanRef = (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    return loan ? `K${Number(loan.loan_amount).toLocaleString()}` : "Loan";
  };

  const totalInstallmentsByLoan = new Map<string, number>();
  repayments.forEach((r) => {
    totalInstallmentsByLoan.set(r.loan_id, (totalInstallmentsByLoan.get(r.loan_id) || 0) + 1);
  });

  const handleDownloadReceipt = (rep: any) => {
    const loan = loans.find((l) => l.id === rep.loan_id);
    if (!loan) return;
    const paidForLoan = repayments
      .filter((r) => r.loan_id === rep.loan_id && r.status === "paid")
      .reduce((s, r) => s + Number(r.principal_paid || r.original_amount || r.amount), 0);
    const totalDue = Number(loan.total_repayment || loan.loan_amount || 0);
    downloadRepaymentReceipt({
      borrowerName: (loan as any).full_name || "Borrower",
      borrowerPhone: (loan as any).phone || "",
      borrowerEmail: (loan as any).email || "",
      loanReference: `LOAN-${loan.id.substring(0, 8).toUpperCase()}`,
      loanAmount: Number(loan.loan_amount),
      repaymentAmount: Number(rep.principal_paid || rep.original_amount || rep.amount),
      paymentDate: rep.paid_date || rep.due_date,
      paymentMethod: rep.payment_method || "cash",
      transactionReference: rep.transaction_reference || `INST-${rep.installment_number}`,
      installmentNumber: rep.installment_number || 1,
      totalInstallments: totalInstallmentsByLoan.get(rep.loan_id) || 1,
      totalPaid: paidForLoan,
      outstandingBalance: Math.max(0, totalDue - paidForLoan),
    });
  };

  const loanFrequencySource = (loan: BorrowerDashboardLoan) => {
    const p = loan.loan_products;
    return {
      term_unit: loan.term_unit,
      loan_term_months: loan.loan_term_months,
      repayment_frequency: p?.repayment_frequency ?? null,
      interest_period: p?.interest_period ?? null,
    };
  };

  const claimsByRepaymentId = new Map<string, any>();
  paymentClaims.forEach((claim) => {
    if (!claimsByRepaymentId.has(claim.repayment_id)) {
      claimsByRepaymentId.set(claim.repayment_id, claim);
    }
  });

  const getClaimStatus = (claim?: any) => {
    if (!claim) return null;
    if (isPaymentClaimApprovedStatus(claim.status)) {
      return { label: "Claim verified", color: "bg-success/20 text-success border-success/30" };
    }
    if (claim.status === "rejected") {
      return { label: "Claim rejected", color: "bg-destructive/20 text-destructive border-destructive/30" };
    }
    if (claim.status === "needs_more_info") {
      return { label: "More info needed", color: "bg-warning/20 text-warning border-warning/30" };
    }
    if (isPaymentClaimPendingStatus(claim.status)) {
      return { label: "Claim pending review", color: "bg-info/20 text-info border-info/30" };
    }
    return { label: `Claim: ${claim.status}`, color: "bg-muted/20 text-muted-foreground border-muted/30" };
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Payments</h2>

      {loadError && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertCircle size={18} className="shrink-0" />
            <span>Could not load payment schedule or claim history. Please reload the page.</span>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Due</p>
            <p className="text-3xl font-bold text-warning mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-3xl font-bold text-success mt-1">{paidCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-foreground mt-1">K{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Overdue Value</p>
            <p className="text-2xl font-bold text-destructive mt-1">K{overdueAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      {sorted.length === 0 ? (
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-12 text-center">
            <Calendar className="mx-auto text-muted-foreground mb-3" size={40} />
            <p className="text-muted-foreground">No payments yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {sorted.map((rep) => {
              const status = getRepaymentStatus(rep);
              const StatusIcon = status.icon;
              const remaining = borrowerRepaymentRemaining(rep);
              const penaltyDue = borrowerRepaymentPenaltyDue(rep);
              const claim = claimsByRepaymentId.get(rep.id);
              const claimStatus = getClaimStatus(claim);
              const loanRow = loans.find((l) => l.id === rep.loan_id);
              return (
                <Card key={rep.id} className="border-border/60 shadow-card">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          K{Number(rep.original_amount || rep.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Installment #{rep.installment_number} • {getLoanRef(rep.loan_id)}
                        </p>
                        {loanRow && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {borrowerInstallmentLabel(loanFrequencySource(loanRow))}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {format(new Date(rep.due_date), "MMM dd, yyyy")}
                        </p>
                        {remaining > 0 && rep.status !== "paid" && (
                          <p className="text-xs text-warning mt-0.5">
                            Remaining: K{remaining.toLocaleString()}
                            {penaltyDue > 0 && ` + K${penaltyDue.toLocaleString()} penalty`}
                          </p>
                        )}
                      </div>
                      <Badge className={`${status.color} border text-[10px]`}>
                        <StatusIcon size={10} className="mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    {claimStatus && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className={`${claimStatus.color} border text-[10px]`}>
                            {claimStatus.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground truncate">Ref: {claim.reference}</span>
                        </div>
                        {claim?.review_comment && (
                          <p className="text-[10px] text-muted-foreground">{claim.review_comment}</p>
                        )}
                      </div>
                    )}
                    {borrowerCanSubmitPaymentClaim(rep) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid="borrower-open-payment-claim"
                        onClick={() => onSubmitPayment(rep)}
                      >
                        <Banknote size={14} className="mr-1.5" />
                        I've paid
                      </Button>
                    )}
                    {rep.status === "paid" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDownloadReceipt(rep)}
                      >
                        <Download size={14} className="mr-1.5" />
                        Download receipt
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-border/60 shadow-card hidden md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((rep) => {
                  const status = getRepaymentStatus(rep);
                  const StatusIcon = status.icon;
                  const remaining = borrowerRepaymentRemaining(rep);
                  const penaltyDue = borrowerRepaymentPenaltyDue(rep);
                  const claim = claimsByRepaymentId.get(rep.id);
                  const claimStatus = getClaimStatus(claim);
                  const loanRow = loans.find((l) => l.id === rep.loan_id);
                  return (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium text-muted-foreground">{rep.installment_number}</TableCell>
                      <TableCell>
                        <div className="font-semibold">K{Number(rep.original_amount || rep.amount).toLocaleString()}</div>
                        {remaining > 0 && rep.status !== "paid" && (
                          <div className="text-[10px] text-warning">
                            K{remaining.toLocaleString()} left
                            {penaltyDue > 0 && ` · penalty K${penaltyDue.toLocaleString()}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{getLoanRef(rep.loan_id)}</div>
                        {loanRow && (
                          <div className="text-[10px] text-muted-foreground/90 mt-0.5">
                            {borrowerInstallmentLabel(loanFrequencySource(loanRow))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(rep.due_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{rep.paid_date ? format(new Date(rep.paid_date), "MMM dd, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${status.color} border`}>
                          <StatusIcon size={10} className="mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {claimStatus ? (
                          <div className="space-y-1">
                            <Badge className={`${claimStatus.color} border text-xs`}>
                              {claimStatus.label}
                            </Badge>
                            {claim?.reference && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[10rem]" title={claim.reference}>
                                Ref: {claim.reference}
                              </p>
                            )}
                            {claim?.review_comment && (
                              <p className="text-[10px] text-muted-foreground max-w-[12rem]" title={claim.review_comment}>
                                {claim.review_comment}
                              </p>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {borrowerCanSubmitPaymentClaim(rep) && (
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="borrower-open-payment-claim"
                            onClick={() => onSubmitPayment(rep)}
                          >
                            <Banknote size={14} className="mr-1.5" />
                            I've paid
                          </Button>
                        )}
                        {rep.status === "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadReceipt(rep)}
                          >
                            <Download size={14} className="mr-1.5" />
                            Receipt
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </Card>
        </>
      )}
    </div>
  );
}
