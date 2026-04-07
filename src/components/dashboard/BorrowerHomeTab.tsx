import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Wallet,
  Calendar,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Eye,
} from "lucide-react";
import { format, isAfter, startOfDay } from "date-fns";
import KYCStatusWidget from "./KYCStatusWidget";
import ContractSigningWidget from "./ContractSigningWidget";
import PaymentReminder from "./PaymentReminder";
import type { BorrowerTab } from "./BorrowerBottomNav";

interface BorrowerHomeTabProps {
  user: any;
  profile: any;
  loans: any[];
  repayments: any[];
  activeLoans: any[];
  kycVerified: boolean;
  isStaff: boolean;
  onTabChange: (tab: BorrowerTab) => void;
}

export default function BorrowerHomeTab({
  user,
  profile,
  loans,
  repayments,
  activeLoans,
  kycVerified,
  isStaff,
  onTabChange,
}: BorrowerHomeTabProps) {
  const totalBorrowed = activeLoans.reduce((sum, l) => sum + Number(l.loan_amount), 0);

  const upcomingRepayments = repayments?.filter(
    (r) => ["pending", "overdue"].includes(r.status) && new Date(r.due_date) >= startOfDay(new Date())
  ) || [];
  const nextPayment = upcomingRepayments.sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )[0];

  const overdueRepayments = repayments?.filter(
    (r) => ["pending", "overdue"].includes(r.status) && isAfter(startOfDay(new Date()), startOfDay(new Date(r.due_date)))
  ) || [];
  const totalOverdue = overdueRepayments.reduce((sum, r) => {
    const originalAmt = Number(r.original_amount || r.amount);
    const alreadyPaid = Number(r.principal_paid || 0);
    return sum + Math.max(0, originalAmt - alreadyPaid);
  }, 0);

  // Overall loan progress for active loans
  const totalPaid = repayments
    ?.filter((r) => activeLoans.some((l) => l.id === r.loan_id))
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0) || 0;
  const totalRepaymentDue = activeLoans.reduce((sum, l) => sum + Number(l.total_repayment || 0), 0);
  const overallProgress = totalRepaymentDue > 0 ? Math.round((totalPaid / totalRepaymentDue) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Hi, {profile?.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Payment Reminders */}
      {repayments && repayments.length > 0 && (
        <PaymentReminder repayments={repayments} />
      )}

      {/* Stats - 2x2 grid for mobile */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Active Loans</p>
            <p className="text-2xl font-bold text-foreground">{activeLoans.length}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Total Borrowed</p>
            <p className="text-2xl font-bold text-foreground">K{totalBorrowed.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass border-border/50">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Next Payment</p>
            {nextPayment ? (
              <>
                <p className="text-lg font-bold text-foreground">
                  K{Math.max(0, Number(nextPayment.original_amount || nextPayment.amount) - Number(nextPayment.principal_paid || 0)).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(nextPayment.due_date), "MMM dd")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming</p>
            )}
          </CardContent>
        </Card>
        <Card className={`glass border-border/50 ${totalOverdue > 0 ? "border-destructive/50" : ""}`}>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Overdue</p>
            <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-destructive" : "text-foreground"}`}>
              K{totalOverdue.toLocaleString()}
            </p>
            {totalOverdue > 0 && (
              <p className="text-[10px] text-destructive">{overdueRepayments.length} payment(s)</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overall progress for active loans */}
      {activeLoans.length > 0 && (
        <Card className="glass border-border/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">Repayment Progress</p>
              <span className="text-xs font-semibold text-primary">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Paid: K{totalPaid.toLocaleString()}</span>
              <span>Remaining: K{Math.max(0, totalRepaymentDue - totalPaid).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KYC Status */}
      {user && <KYCStatusWidget userId={user.id} />}

      {/* Contract Signing */}
      {user && <ContractSigningWidget userId={user.id} />}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-1 glass border-border/50"
          onClick={() => onTabChange("loans")}
        >
          <Eye size={20} className="text-primary" />
          <span className="text-xs">View Loans</span>
        </Button>
        <Button
          variant="hero"
          className="h-auto py-4 flex flex-col gap-1"
          onClick={() => onTabChange("apply")}
        >
          <TrendingUp size={20} />
          <span className="text-xs">Apply Now</span>
        </Button>
      </div>
    </div>
  );
}
