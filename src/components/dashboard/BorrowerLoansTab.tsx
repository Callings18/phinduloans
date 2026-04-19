import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Loader2,
  Download,
  Receipt,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Banknote,
  FileText,
  Activity,
} from "lucide-react";
import { format, isAfter, differenceInDays, startOfDay } from "date-fns";
import { ApplicationStatusTracker } from "./ApplicationStatusTracker";
import DocumentChecklist from "./DocumentChecklist";
import { borrowerInstallmentLabel, borrowerTermShortLabel } from "@/utils/repaymentFrequencyLabels";
import type { BorrowerDashboardLoan } from "@/types/borrowerDashboard";
import { getCanonicalStatusLabel, getCanonicalStatusBadgeClasses } from "@/constants/loanStatusLabels";

function loanFrequencySource(loan: BorrowerDashboardLoan) {
  const p = loan.loan_products;
  return {
    term_unit: loan.term_unit,
    loan_term_months: loan.loan_term_months,
    repayment_frequency: p?.repayment_frequency ?? null,
    interest_period: p?.interest_period ?? null,
  };
}

// Icons remain product-specific; labels and colors come from the canonical
// status helpers so borrower wording matches admin wording 1:1.
const statusIcons: Record<string, any> = {
  pending: Clock,
  under_review: FileText,
  approved: CheckCircle,
  contract_signing: FileText,
  awaiting_disbursement: Banknote,
  rejected: AlertCircle,
  disbursed: CreditCard,
  active: TrendingUp,
  completed: CheckCircle,
  defaulted: AlertCircle,
};

function getStatusDisplay(status: string) {
  return {
    label: getCanonicalStatusLabel(status),
    color: getCanonicalStatusBadgeClasses(status),
    icon: statusIcons[status] || Clock,
  };
}

interface Props {
  userId: string;
  loans: BorrowerDashboardLoan[];
  repayments: any[];
  loanEvents?: Array<{
    id: string;
    loan_id: string;
    event_type: string;
    reason?: string | null;
    created_at: string;
    new_values?: Record<string, unknown> | null;
  }>;
  onDownloadStatement: (loan: any) => void;
  onDownloadSchedule: (loan: any) => void;
  onSubmitPayment: (rep: any) => void;
  isGenerating: string | null;
  onApply: () => void;
}

export default function BorrowerLoansTab({
  userId,
  loans,
  repayments,
  loanEvents = [],
  onDownloadStatement,
  onDownloadSchedule,
  onSubmitPayment,
  isGenerating,
  onApply,
}: Props) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const activeLoans = loans.filter((l) => ["active", "disbursed"].includes(l.status));
  const pendingApps = loans.filter((l) => ["pending", "under_review", "approved", "contract_signing", "awaiting_disbursement"].includes(l.status));
  const completedLoans = loans.filter((l) => l.status === "completed");
  const recentEvents = loanEvents.slice(0, 5);

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

  const getLoanProgress = (loanId: string) => {
    const lr = repayments.filter((r) => r.loan_id === loanId);
    const paid = lr.filter((r) => r.status === "paid").length;
    return lr.length > 0 ? (paid / lr.length) * 100 : 0;
  };

  const renderLoanCard = (loan: any, showSchedule = true) => {
    const config = getStatusDisplay(loan.status);
    const StatusIcon = config.icon;
    const loanRepayments = repayments.filter((r) => r.loan_id === loan.id);
    const progress = getLoanProgress(loan.id);
    const isExpanded = expandedLoan === loan.id;
    const paidAmount = loanRepayments.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.principal_paid || r.original_amount || r.amount), 0);
    const partialOnPending = loanRepayments.filter((r) => r.status !== "paid").reduce((sum, r) => sum + Number(r.principal_paid || 0), 0);
    const totalPaidAmount = paidAmount + partialOnPending;
    const remainingAmount = Math.max(0, Number(loan.total_repayment || 0) - totalPaidAmount);

    return (
      <Collapsible key={loan.id} open={isExpanded} onOpenChange={() => setExpandedLoan(isExpanded ? null : loan.id)}>
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <StatusIcon className="text-primary" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">K{Number(loan.loan_amount).toLocaleString()}</h4>
                  <p className="text-muted-foreground text-xs">
                    {loan.loan_purpose} • {borrowerTermShortLabel(loanFrequencySource(loan))} •{" "}
                    {borrowerInstallmentLabel(loanFrequencySource(loan))}
                  </p>
                  <Badge className={`${config.color} border text-[10px] mt-1`}>{config.label}</Badge>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* Progress */}
            {showSchedule && loanRepayments.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-foreground font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Paid: K{totalPaidAmount.toLocaleString()}</span>
                  <span>Left: K{remainingAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {showSchedule && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onDownloadSchedule(loan)} disabled={isGenerating === `schedule-${loan.id}`}>
                    {isGenerating === `schedule-${loan.id}` ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} className="mr-1" />}
                    Schedule
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onDownloadStatement(loan)} disabled={isGenerating === loan.id}>
                    {isGenerating === loan.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} className="mr-1" />}
                    Statement
                  </Button>
                </>
              )}
            </div>

            {/* Expanded Schedule */}
            <CollapsibleContent>
              <div className="border-t border-border/50 pt-3 mt-1 space-y-2">
                <h5 className="text-xs font-semibold text-foreground">Repayment Schedule</h5>
                {loanRepayments.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No repayments scheduled yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {loanRepayments.map((rep) => {
                      const status = getRepaymentStatus(rep);
                      const StatusIcon = status.icon;
                      return (
                        <div key={rep.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border/40 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-background flex items-center justify-center text-[10px] font-medium shrink-0">
                              #{rep.installment_number}
                            </span>
                            <div>
                              <p className="font-medium text-foreground">K{Number(rep.original_amount || rep.amount).toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(rep.due_date), "MMM dd, yyyy")}
                                {rep.paid_date && ` • Paid: ${format(new Date(rep.paid_date), "MMM dd")}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {["pending", "overdue"].includes(rep.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                data-testid="borrower-open-payment-claim"
                                onClick={() => onSubmitPayment(rep)}
                              >
                                <Banknote size={10} className="mr-0.5" />
                                I've paid
                              </Button>
                            )}
                            <Badge className={`${status.color} border text-[10px] px-1.5 py-0`}>
                              <StatusIcon size={8} className="mr-0.5" />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
    );
  };

  const EmptyState = ({ icon: Icon, title, subtitle, showCta = false }: { icon: any; title: string; subtitle: string; showCta?: boolean }) => (
    <Card className="border-border/60 shadow-card">
      <CardContent className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 mx-auto mb-3 flex items-center justify-center">
          <Icon className="text-muted-foreground" size={24} />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
        {showCta && (
          <Button className="gradient-primary text-primary-foreground hover:opacity-90" size="sm" onClick={onApply}>Apply for a Loan</Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">My Loans</h2>

      {recentEvents.length > 0 && (
        <Card className="border-border/60 shadow-card">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Recent Loan Activity</h3>
            {recentEvents.map((ev) => (
              <div key={ev.id} className="text-xs text-muted-foreground border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{ev.event_type.replace(/_/g, " ")}</span>
                  <span>{format(new Date(ev.created_at), "MMM dd, HH:mm")}</span>
                </div>
                {ev.reason && <p className="mt-0.5">{ev.reason}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-10 bg-secondary/70 border border-border/60">
          <TabsTrigger value="tracker" className="text-xs gap-1"><Activity size={12} />Track</TabsTrigger>
          <TabsTrigger value="active" className="text-xs gap-1"><TrendingUp size={12} />Active ({activeLoans.length})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs gap-1"><Clock size={12} />Pending ({pendingApps.length})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs gap-1"><CheckCircle size={12} />Done ({completedLoans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="space-y-3 mt-3">
          <ApplicationStatusTracker userId={userId} />
          {loans
            .filter((l) => ["pending", "under_review", "approved", "contract_signing", "awaiting_disbursement"].includes(l.status))
            .map((loan) => (
            <DocumentChecklist key={loan.id} loanId={loan.id} userId={userId} />
          ))}
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-3">
          {activeLoans.length === 0 ? (
            <EmptyState icon={CreditCard} title="No Active Loans" subtitle="You don't have any active loans" showCta />
          ) : (
            activeLoans.map((loan) => renderLoanCard(loan, true))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-3">
          {pendingApps.length === 0 ? (
            <EmptyState icon={Clock} title="No Pending Applications" subtitle="All applications have been processed" />
          ) : (
            pendingApps.map((loan) => renderLoanCard(loan, false))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-3">
          {completedLoans.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No Completed Loans" subtitle="Completed loans will appear here" />
          ) : (
            completedLoans.map((loan) => renderLoanCard(loan, true))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
