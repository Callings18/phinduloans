import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { BorrowerTab } from "@/pages/Dashboard";

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

  const totalPaid = repayments
    ?.filter((r) => activeLoans.some((l) => l.id === r.loan_id))
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0) || 0;
  const totalRepaymentDue = activeLoans.reduce((sum, l) => sum + Number(l.total_repayment || 0), 0);
  const overallProgress = totalRepaymentDue > 0 ? Math.round((totalPaid / totalRepaymentDue) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Payment Reminders */}
      {repayments && repayments.length > 0 && (
        <PaymentReminder repayments={repayments} />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="text-primary" size={20} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-3xl font-bold text-foreground mt-1">{activeLoans.length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="text-primary" size={20} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Borrowed</p>
            <p className="text-3xl font-bold text-foreground mt-1">K{totalBorrowed.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="text-primary" size={20} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Next Payment</p>
            {nextPayment ? (
              <div className="mt-1">
                <p className="text-2xl font-bold text-foreground">
                  K{Math.max(0, Number(nextPayment.original_amount || nextPayment.amount) - Number(nextPayment.principal_paid || 0)).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Due {format(new Date(nextPayment.due_date), "MMM dd, yyyy")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No upcoming</p>
            )}
          </CardContent>
        </Card>

        <Card className={`border-border/50 ${totalOverdue > 0 ? "border-destructive/50" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalOverdue > 0 ? "bg-destructive/10" : "bg-primary/10"}`}>
                <AlertTriangle className={totalOverdue > 0 ? "text-destructive" : "text-primary"} size={20} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className={`text-3xl font-bold mt-1 ${totalOverdue > 0 ? "text-destructive" : "text-foreground"}`}>
              K{totalOverdue.toLocaleString()}
            </p>
            {totalOverdue > 0 && (
              <p className="text-xs text-destructive mt-0.5">{overdueRepayments.length} payment(s) overdue</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout for larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repayment Progress */}
        {activeLoans.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Repayment Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Overall completion</span>
                <span className="text-sm font-semibold text-primary">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Paid: K{totalPaid.toLocaleString()}</span>
                <span>Remaining: K{Math.max(0, totalRepaymentDue - totalPaid).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYC Status */}
        {user && <KYCStatusWidget userId={user.id} />}
      </div>

      {/* Contract Signing */}
      {user && <ContractSigningWidget userId={user.id} />}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-auto py-5 flex flex-col gap-2 border-border/50"
          onClick={() => onTabChange("loans")}
        >
          <Eye size={22} className="text-primary" />
          <span className="text-sm font-medium">View Loans</span>
        </Button>
        <Button
          variant="hero"
          className="h-auto py-5 flex flex-col gap-2"
          onClick={() => onTabChange("apply")}
        >
          <TrendingUp size={22} />
          <span className="text-sm font-medium">Apply Now</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-5 flex flex-col gap-2 border-border/50"
          onClick={() => onTabChange("payments")}
        >
          <Calendar size={22} className="text-primary" />
          <span className="text-sm font-medium">Payments</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-5 flex flex-col gap-2 border-border/50"
          onClick={() => onTabChange("profile")}
        >
          <Wallet size={22} className="text-primary" />
          <span className="text-sm font-medium">My Profile</span>
        </Button>
      </div>
    </div>
  );
}
