import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Banknote,
  Calendar,
} from "lucide-react";
import { format, isAfter, differenceInDays, startOfDay } from "date-fns";

interface Props {
  repayments: any[];
  loans: any[];
  paymentClaims: any[];
  onSubmitPayment: (rep: any) => void;
}

export default function BorrowerPaymentsTab({ repayments, loans, paymentClaims, onSubmitPayment }: Props) {
  const getRepaymentStatus = (rep: any) => {
    const today = startOfDay(new Date());
    const dueDate = startOfDay(new Date(rep.due_date));
    const isOverdue = ["pending", "overdue"].includes(rep.status) && isAfter(today, dueDate);
    const daysOverdue = isOverdue ? differenceInDays(today, dueDate) : 0;
    if (rep.status === "paid") return { label: "Paid", color: "bg-success/20 text-success border-success/30", icon: CheckCircle };
    if (rep.status === "cancelled") return { label: "Cancelled", color: "bg-muted/20 text-muted-foreground border-muted/30", icon: AlertCircle };
    if (isOverdue || rep.status === "overdue") return { label: `${daysOverdue}d overdue`, color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle };
    return { label: "Pending", color: "bg-warning/20 text-warning border-warning/30", icon: Clock };
  };

  // Sort: overdue first, then pending by date, then paid
  const sorted = [...repayments].sort((a, b) => {
    const order = { overdue: 0, pending: 1, paid: 2, cancelled: 3 };
    const aStatus = ["pending", "overdue"].includes(a.status) && isAfter(startOfDay(new Date()), startOfDay(new Date(a.due_date))) ? "overdue" : a.status;
    const bStatus = ["pending", "overdue"].includes(b.status) && isAfter(startOfDay(new Date()), startOfDay(new Date(b.due_date))) ? "overdue" : b.status;
    const orderDiff = (order[aStatus as keyof typeof order] ?? 4) - (order[bStatus as keyof typeof order] ?? 4);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const pendingCount = repayments.filter((r) => ["pending", "overdue"].includes(r.status)).length;
  const paidCount = repayments.filter((r) => r.status === "paid").length;
  const totalPaid = repayments.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);

  const getLoanRef = (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    return loan ? `K${Number(loan.loan_amount).toLocaleString()}` : "Loan";
  };

  const claimsByRepaymentId = new Map<string, any>();
  paymentClaims.forEach((claim) => {
    if (!claimsByRepaymentId.has(claim.repayment_id)) {
      claimsByRepaymentId.set(claim.repayment_id, claim);
    }
  });

  const getClaimStatus = (claim?: any) => {
    if (!claim) return null;
    if (claim.status === "verified" || claim.status === "approved") {
      return { label: "Claim verified", color: "bg-success/20 text-success border-success/30" };
    }
    if (claim.status === "rejected") {
      return { label: "Claim rejected", color: "bg-destructive/20 text-destructive border-destructive/30" };
    }
    return { label: "Claim pending", color: "bg-info/20 text-info border-info/30" };
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Payments</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Due</p>
            <p className="text-lg font-bold text-warning">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-success">{paidCount}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Total Paid</p>
            <p className="text-sm font-bold text-foreground">K{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment list */}
      {sorted.length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="p-8 text-center">
            <Calendar className="mx-auto text-muted-foreground mb-2" size={32} />
            <p className="text-sm text-muted-foreground">No payments yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((rep) => {
            const status = getRepaymentStatus(rep);
            const StatusIcon = status.icon;
            const remaining = Math.max(0, Number(rep.original_amount || rep.amount) - Number(rep.principal_paid || 0));
            const claim = claimsByRepaymentId.get(rep.id);
            const claimStatus = getClaimStatus(claim);
            return (
              <Card key={rep.id} className="glass border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-bold shrink-0">
                        #{rep.installment_number}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          K{Number(rep.original_amount || rep.amount).toLocaleString()}
                          <span className="text-muted-foreground text-xs ml-1">({getLoanRef(rep.loan_id)})</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(rep.due_date), "MMM dd, yyyy")}
                          {rep.paid_date && ` • Paid ${format(new Date(rep.paid_date), "MMM dd")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {["pending", "overdue"].includes(rep.status) && remaining > 0 && (
                        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => onSubmitPayment(rep)}>
                          <Banknote size={10} className="mr-0.5" />
                          Pay
                        </Button>
                      )}
                      <Badge className={`${status.color} border text-[10px] px-1.5 py-0`}>
                        <StatusIcon size={8} className="mr-0.5" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                  {claimStatus && (
                    <div className="mt-2 flex items-center justify-between">
                      <Badge className={`${claimStatus.color} border text-[10px] px-1.5 py-0`}>
                        {claimStatus.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Ref: {claim.reference}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
