import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  Banknote,
  CheckCircle2,
  Eye,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { format, isAfter, startOfDay } from "date-fns";
import KYCStatusWidget from "./KYCStatusWidget";
import ContractSigningWidget from "./ContractSigningWidget";
import PaymentReminder from "./PaymentReminder";
import WalletWidget from "./WalletWidget";
import BorrowerSupportCard from "./BorrowerSupportCard";
import EligibilityWidget from "./EligibilityWidget";
import ResumeApplicationBanner from "./ResumeApplicationBanner";
import type { BorrowerTab } from "./BorrowerBottomNav";
import type { LucideIcon } from "lucide-react";
import type { BorrowerDashboardLoan } from "@/types/borrowerDashboard";

type HomeNextStep = {
  title: string;
  description: string;
  cta: string;
  tab: BorrowerTab;
  icon: LucideIcon;
  /** When set (e.g. KYC incomplete), primary CTA uses this instead of dashboard tab change. */
  navigate?: () => void;
};

interface BorrowerHomeTabProps {
  user: any;
  profile: any;
  kycInfo?: any;
  loans: BorrowerDashboardLoan[];
  repayments: any[];
  activeLoans: BorrowerDashboardLoan[];
  kycVerified: boolean;
  isStaff: boolean;
  onTabChange: (tab: BorrowerTab) => void;
  /** Opens in-dashboard KYC sheet (or profile when staff `?view=`). */
  onOpenKycDocuments?: () => void;
  hasDraft?: boolean;
  draftLastSaved?: Date | null;
  onResumeDraft?: () => void;
  onDiscardDraft?: () => void;
}

export default function BorrowerHomeTab({
  user,
  profile,
  kycInfo,
  loans,
  repayments,
  activeLoans,
  kycVerified,
  isStaff,
  onTabChange,
  onOpenKycDocuments,
  hasDraft,
  draftLastSaved,
  onResumeDraft,
  onDiscardDraft,
}: BorrowerHomeTabProps) {
  void isStaff;

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
  const fullName = profile?.full_name?.trim() || "Customer";
  const firstName = fullName.split(" ")[0] || "Customer";
  const initials = fullName.slice(0, 1).toUpperCase();
  const walletBalance = Math.max(totalPaid, 0);
  const nextPaymentAmount = nextPayment
    ? Math.max(0, Number(nextPayment.original_amount || nextPayment.amount) - Number(nextPayment.principal_paid || 0))
    : 0;
  const totalDisbursed = loans
    .filter((loan) => ["disbursed", "active", "completed"].includes(loan.status))
    .reduce((sum, loan) => sum + Number(loan.loan_amount || 0), 0);
  const hasBankDetails = Boolean(kycInfo?.bank_name && kycInfo?.bank_account_number);
  const hasMobileMoney = Boolean(
    kycInfo?.airtel_money_number || kycInfo?.mtn_mobile_money_number || kycInfo?.zamtel_kwacha_number
  );
  const disbursementDestination = (() => {
    if (hasBankDetails) {
      const account = String(kycInfo.bank_account_number);
      const masked = account.length > 4 ? `****${account.slice(-4)}` : account;
      return `${kycInfo.bank_name} (${masked})`;
    }
    if (kycInfo?.mtn_mobile_money_number) return `MTN Mobile Money (${kycInfo.mtn_mobile_money_number})`;
    if (kycInfo?.airtel_money_number) return `Airtel Money (${kycInfo.airtel_money_number})`;
    if (kycInfo?.zamtel_kwacha_number) return `Zamtel Kwacha (${kycInfo.zamtel_kwacha_number})`;
    return null;
  })();
  const accountHealth = (() => {
    const blockers: string[] = [];
    if (!kycVerified) blockers.push("Complete KYC verification");
    if (!hasBankDetails && !hasMobileMoney) blockers.push("Add payout destination (mobile money or bank)");
    if (totalOverdue > 0) blockers.push(`Resolve overdue repayments (K${totalOverdue.toLocaleString()})`);
    return {
      status: blockers.length === 0 ? "healthy" : blockers.length === 1 ? "warning" : "critical",
      blockers,
    };
  })();

  const nextStep: HomeNextStep = (() => {
    if (!kycVerified) {
      return {
        title: "Complete KYC verification",
        description: "Upload NRC, selfie, and payout details to unlock faster approvals and disbursement.",
        cta: "Open KYC & documents",
        tab: "profile" as BorrowerTab,
        navigate: onOpenKycDocuments,
        icon: ShieldAlert,
      };
    }
    if (!hasBankDetails && !hasMobileMoney) {
      return {
        title: "Add payout details",
        description:
          "Add a bank account or mobile money number so approved loans can be disbursed to you.",
        cta: "Open profile & payout",
        tab: "profile" as BorrowerTab,
        navigate: onOpenKycDocuments,
        icon: Banknote,
      };
    }
    if (totalOverdue > 0) {
      return {
        title: "Resolve overdue repayments",
        description: `You have K${totalOverdue.toLocaleString()} overdue. Submit payment claims to avoid penalties.`,
        cta: "Open payments",
        tab: "payments" as BorrowerTab,
        icon: Banknote,
      };
    }
    if (activeLoans.length > 0) {
      return {
        title: "Track your active loan",
        description: nextPayment
          ? `Your next payment is K${nextPaymentAmount.toLocaleString()} due ${format(new Date(nextPayment.due_date), "MMM dd")}.`
          : "Check your repayment schedule and keep your account in good standing.",
        cta: "View my loans",
        tab: "loans" as BorrowerTab,
        icon: CheckCircle2,
      };
    }
    return {
      title: "Apply for a new loan",
      description: "You’re all set. Start a new application in minutes.",
      cta: "Apply now",
      tab: "apply" as BorrowerTab,
      icon: Sparkles,
    };
  })();
  const NextStepIcon = nextStep.icon;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-border/60 gradient-card shadow-elevated text-card-foreground">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground flex items-center justify-center font-semibold">
                {initials}
              </div>
              <div>
                <p className="text-sm/4 text-muted-foreground">Hello, {fullName}</p>
                <p className="text-base font-semibold">Welcome back</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{format(new Date(), "MMM d, yyyy")}</p>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Repayments posted (paid)</p>
            <p className="text-3xl font-bold">K{walletBalance.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground px-2">
              Total you have already paid toward installments. For disbursements and outstanding balance, see the card below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-10 gradient-primary text-primary-foreground hover:opacity-90 font-semibold rounded-xl"
              onClick={() => onTabChange("payments")}
            >
              <Banknote size={16} className="mr-1" /> Make Payment
            </Button>
            <Button
              className="h-10 gradient-primary text-primary-foreground hover:opacity-90 font-semibold rounded-xl"
              onClick={() => onTabChange("apply")}
            >
              <TrendingUp size={16} className="mr-1" /> Apply Loan
            </Button>
          </div>

          <div className="rounded-2xl bg-secondary/70 border border-border/60 p-3">
            <p className="text-xs text-muted-foreground mb-2">Disbursements & balance</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-semibold border border-primary/30">
                ZMW
              </span>
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                Disbursed: K{totalDisbursed.toLocaleString()}
              </span>
              {disbursementDestination ? (
                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  Destination: {disbursementDestination}
                </span>
              ) : (
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => (onOpenKycDocuments ? onOpenKycDocuments() : onTabChange("profile"))}
                >
                  Add payout details
                </button>
              )}
            </div>
            {!hasBankDetails && !hasMobileMoney && (
              <p className="text-[11px] text-warning mt-2">
                Add mobile money or bank details in Profile so admin can disburse to your preferred destination.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resume application banner */}
      {hasDraft && onResumeDraft && activeLoans.length === 0 && (
        <ResumeApplicationBanner
          lastSaved={draftLastSaved ?? null}
          onResume={onResumeDraft}
          onDiscard={onDiscardDraft ?? (() => {})}
        />
      )}

      {/* Indicative eligibility */}
      <EligibilityWidget
        monthlyIncome={profile?.monthly_income}
        hasActiveLoan={activeLoans.length > 0}
        onApply={() => onTabChange("apply")}
      />

      {/* Payment Reminders */}
      {repayments && repayments.length > 0 && (
        <PaymentReminder repayments={repayments} />
      )}

      <Card className="border-primary/30 bg-primary/5 shadow-card">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <NextStepIcon size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold">What’s next</p>
              <h3 className="text-sm font-semibold text-foreground">{nextStep.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{nextStep.description}</p>
            </div>
          </div>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground hover:opacity-90 h-8 px-3 text-xs shrink-0"
            onClick={() => {
              if (nextStep.navigate) nextStep.navigate();
              else onTabChange(nextStep.tab);
            }}
          >
            {nextStep.cta}
          </Button>
        </CardContent>
      </Card>

      <Card
        className={
          accountHealth.status === "healthy"
            ? "border-success/40 bg-success/5 shadow-card"
            : accountHealth.status === "warning"
              ? "border-warning/40 bg-warning/10 shadow-card"
              : "border-destructive/40 bg-destructive/10 shadow-card"
        }
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">Account Health</p>
            <span className="text-xs text-muted-foreground">
              {accountHealth.status === "healthy" ? "All clear" : `${accountHealth.blockers.length} blocker(s)`}
            </span>
          </div>
          {accountHealth.blockers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Your account is ready for smooth disbursement and repayment operations.
            </p>
          ) : (
            <div className="space-y-1">
              {accountHealth.blockers.map((blocker) => (
                <p key={blocker} className="text-xs text-foreground">
                  - {blocker}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/60 bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <button className="space-y-1" onClick={() => onTabChange("loans")} type="button">
              <div className="h-12 w-12 mx-auto rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center text-primary">
                <ArrowDownLeft size={18} />
              </div>
              <p className="text-xs text-muted-foreground">Disbursements</p>
            </button>
            <button className="space-y-1" onClick={() => onTabChange("payments")} type="button">
              <div className="h-12 w-12 mx-auto rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center text-accent">
                <Banknote size={18} />
              </div>
              <p className="text-xs text-muted-foreground">Repay</p>
            </button>
            <button
              className="space-y-1"
              onClick={() => (onOpenKycDocuments ? onOpenKycDocuments() : onTabChange("profile"))}
              type="button"
            >
              <div className="h-12 w-12 mx-auto rounded-full border border-info/30 bg-info/10 flex items-center justify-center text-info">
                <ShieldAlert size={18} />
              </div>
              <p className="text-xs text-muted-foreground">KYC & Wallet</p>
            </button>
            <button className="space-y-1" onClick={() => onTabChange("apply")} type="button">
              <div className="h-12 w-12 mx-auto rounded-full border border-warning/30 bg-warning/10 flex items-center justify-center text-warning">
                <Sparkles size={18} />
              </div>
              <p className="text-xs text-muted-foreground">New Loan</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Active Loans</p>
            <p className="text-xl font-bold text-foreground">{activeLoans.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Total Borrowed</p>
            <p className="text-xl font-bold text-foreground">K{totalBorrowed.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Next Payment</p>
            {nextPayment ? (
              <>
                <p className="text-lg font-bold text-foreground">K{nextPaymentAmount.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">{format(new Date(nextPayment.due_date), "MMM dd")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming</p>
            )}
          </CardContent>
        </Card>
        <Card className={totalOverdue > 0 ? "border-destructive/50" : "border-border/60"}>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Overdue</p>
            <p className={`text-xl font-bold ${totalOverdue > 0 ? "text-destructive" : "text-foreground"}`}>
              K{totalOverdue.toLocaleString()}
            </p>
            {totalOverdue > 0 && <p className="text-[11px] text-destructive">{overdueRepayments.length} payment(s)</p>}
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
      {user && <KYCStatusWidget userId={user.id} onOpenDocuments={onOpenKycDocuments} />}

      {/* Wallet transactions linked to real disbursement/repayment records */}
      {user && <WalletWidget />}

      {/* Contract Signing */}
      {user && <ContractSigningWidget userId={user.id} />}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-1 rounded-xl"
          onClick={() => onTabChange("loans")}
        >
          <Eye size={20} className="text-primary" />
          <span className="text-xs">View Loans</span>
        </Button>
        <Button
          className="h-auto py-4 flex flex-col gap-1 rounded-xl gradient-primary text-primary-foreground hover:opacity-90"
          onClick={() => onTabChange("apply")}
        >
          <TrendingUp size={20} />
          <span className="text-xs">Apply Now</span>
        </Button>
      </div>
    </div>
  );
}
