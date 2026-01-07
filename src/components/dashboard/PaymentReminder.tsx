import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    Calendar,
    Clock,
    X,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Bell,
    BellOff
} from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Repayment {
    id: string;
    loan_id: string;
    amount: number;
    due_date: string;
    status: string;
    installment_number?: number;
}

interface PaymentReminderProps {
    repayments: Repayment[];
    className?: string;
}

const PaymentReminder = ({ repayments, className }: PaymentReminderProps) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);
    const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);

    const today = new Date();

    // Check if snoozed
    if (snoozedUntil && isBefore(today, snoozedUntil)) {
        return null;
    }

    // Filter pending repayments
    const pendingRepayments = repayments.filter(r => r.status === 'pending');

    // Categorize payments
    const overduePayments = pendingRepayments.filter(r =>
        isAfter(today, new Date(r.due_date))
    );

    const dueSoon = pendingRepayments.filter(r => {
        const dueDate = new Date(r.due_date);
        const daysUntil = differenceInDays(dueDate, today);
        return daysUntil >= 0 && daysUntil <= 7;
    });

    const totalOverdue = overduePayments.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalDueSoon = dueSoon.reduce((sum, r) => sum + Number(r.amount), 0);

    // Nothing to show
    if (overduePayments.length === 0 && dueSoon.length === 0) {
        return null;
    }

    if (isDismissed) {
        return null;
    }

    const hasOverdue = overduePayments.length > 0;
    const nextPayment = dueSoon[0];
    const daysUntilNext = nextPayment
        ? differenceInDays(new Date(nextPayment.due_date), today)
        : null;

    const handleSnooze = () => {
        setSnoozedUntil(addDays(today, 1));
    };

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300",
            hasOverdue
                ? "border-destructive/50 bg-destructive/5"
                : "border-warning/50 bg-warning/5",
            className
        )}>
            <CardContent className="p-0">
                {/* Header */}
                <div
                    className={cn(
                        "p-4 flex items-center justify-between cursor-pointer",
                        hasOverdue ? "bg-destructive/10" : "bg-warning/10"
                    )}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            hasOverdue ? "bg-destructive/20" : "bg-warning/20"
                        )}>
                            {hasOverdue ? (
                                <AlertTriangle className="text-destructive" size={20} />
                            ) : (
                                <Bell className="text-warning" size={20} />
                            )}
                        </div>
                        <div>
                            <h3 className={cn(
                                "font-semibold",
                                hasOverdue ? "text-destructive" : "text-warning"
                            )}>
                                {hasOverdue
                                    ? `${overduePayments.length} Overdue Payment${overduePayments.length > 1 ? 's' : ''}`
                                    : 'Upcoming Payment'
                                }
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {hasOverdue
                                    ? `Total: K${totalOverdue.toLocaleString()} overdue`
                                    : daysUntilNext === 0
                                        ? 'Due today!'
                                        : daysUntilNext === 1
                                            ? 'Due tomorrow'
                                            : `Due in ${daysUntilNext} days`
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!hasOverdue && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSnooze();
                                }}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <BellOff size={16} className="mr-1" />
                                Snooze
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDismissed(true);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X size={16} />
                        </Button>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>

                {/* Expandable Content */}
                {isExpanded && (
                    <div className="p-4 space-y-4">
                        {/* Overdue Payments */}
                        {overduePayments.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    Overdue
                                </h4>
                                {overduePayments.slice(0, 3).map((payment) => {
                                    const daysOverdue = differenceInDays(today, new Date(payment.due_date));
                                    return (
                                        <div
                                            key={payment.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-xs font-medium text-destructive">
                                                    #{payment.installment_number || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">K{Number(payment.amount).toLocaleString()}</p>
                                                    <p className="text-xs text-destructive">
                                                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="destructive" className="text-xs">
                                                Due {format(new Date(payment.due_date), 'MMM dd')}
                                            </Badge>
                                        </div>
                                    );
                                })}
                                {overduePayments.length > 3 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        +{overduePayments.length - 3} more overdue payment{overduePayments.length - 3 > 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Upcoming Payments */}
                        {dueSoon.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-warning flex items-center gap-2">
                                    <Clock size={14} />
                                    Due This Week
                                </h4>
                                {dueSoon.slice(0, 3).map((payment) => {
                                    const daysUntil = differenceInDays(new Date(payment.due_date), today);
                                    return (
                                        <div
                                            key={payment.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-xs font-medium text-warning">
                                                    #{payment.installment_number || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">K{Number(payment.amount).toLocaleString()}</p>
                                                    <p className="text-xs text-warning">
                                                        {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `Due in ${daysUntil} days`}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
                                                {format(new Date(payment.due_date), 'MMM dd')}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Action Button */}
                        <div className="pt-2 flex gap-2">
                            <Button variant="hero" className="flex-1" asChild>
                                <Link to="/dashboard?tab=active">
                                    <CreditCard size={16} className="mr-2" />
                                    View Payment Details
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default PaymentReminder;
