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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Payments</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
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
        <Card className="border-border/60 shadow-card">
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
                  const remaining = Math.max(0, Number(rep.original_amount || rep.amount) - Number(rep.principal_paid || 0));
                  const claim = claimsByRepaymentId.get(rep.id);
                  const claimStatus = getClaimStatus(claim);
                  return (
                    <TableRow key={rep.id}>
                      <TableCell className="font-medium text-muted-foreground">{rep.installment_number}</TableCell>
                      <TableCell className="font-semibold">K{Number(rep.original_amount || rep.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">{getLoanRef(rep.loan_id)}</TableCell>
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
                          <Badge className={`${claimStatus.color} border text-xs`}>
                            {claimStatus.label}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {["pending", "overdue"].includes(rep.status) && remaining > 0 && (
                          <Button variant="outline" size="sm" onClick={() => onSubmitPayment(rep)}>
                            <Banknote size={14} className="mr-1.5" />
                            I've paid
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
      )}
    </div>
  );
}
