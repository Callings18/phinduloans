import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { Calendar } from "@phinduloans/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@phinduloans/shared/components/ui/popover";
import { CalendarIcon, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@phinduloans/shared/lib/utils";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { previewAllocation, type AllocationInstallment } from "@phinduloans/shared/utils/paymentAllocation";

export interface GuidedPaymentValue {
  repaymentId: string;
  amount: number;
  penaltyAmount: number;
  paymentMethod: string;
  accountId: string;
  paidDate: string;
  transactionReference?: string;
}

interface GuidedPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrowerName?: string;
  repayments: AllocationInstallment[];
  accounts: Array<{ id: string; account_name: string }>;
  defaultAccountId?: string;
  isSubmitting?: boolean;
  onConfirm: (value: GuidedPaymentValue) => void;
}

const k = (v: number) => `K${(Math.round(v * 100) / 100).toLocaleString()}`;

export function GuidedPaymentDialog({
  open,
  onOpenChange,
  borrowerName,
  repayments,
  accounts,
  defaultAccountId = "",
  isSubmitting,
  onConfirm,
}: GuidedPaymentDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [paidDate, setPaidDate] = useState<Date>(new Date());
  const [reference, setReference] = useState("");

  const payable = useMemo(
    () =>
      [...repayments]
        .filter((r) => {
          const s = (r.status ?? "pending").toLowerCase();
          return s === "pending" || s === "overdue" || s === "partial";
        })
        .sort((a, b) => Number(a.installment_number ?? 0) - Number(b.installment_number ?? 0)),
    [repayments],
  );

  const totalPenaltyDue = useMemo(
    () =>
      payable.reduce(
        (s, r) => s + Math.max(Number(r.penalty_amount ?? 0) - Number(r.penalty_paid ?? 0), 0),
        0,
      ),
    [payable],
  );

  useEffect(() => {
    if (open) {
      setStep(1);
      setAmount("");
      setPaymentMethod("cash");
      setAccountId(defaultAccountId);
      setPaidDate(new Date());
      setReference("");
    }
  }, [open, defaultAccountId]);

  const numAmount = Number(amount) || 0;
  // Penalty is auto-allocated first (same as the server cascade).
  const penaltyAllocation = Math.min(numAmount, totalPenaltyDue);

  const preview = useMemo(
    () => previewAllocation(payable, numAmount, penaltyAllocation),
    [payable, numAmount, penaltyAllocation],
  );

  const touchedLines = preview.lines.filter(
    (l) => l.principalApplied > 0 || l.penaltyApplied > 0,
  );

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const isFutureDate = paidDate > todayEnd;

  const canProceed =
    numAmount > 0 &&
    accountId &&
    !isFutureDate &&
    preview.unapplied <= 0.01 &&
    touchedLines.length > 0;

  const handleNext = () => {
    if (numAmount <= 0) {
      toast({ title: "Enter an amount", description: "Payment must be greater than zero.", variant: "destructive" });
      return;
    }
    if (!accountId) {
      toast({ title: "Account required", description: "Choose the account to credit.", variant: "destructive" });
      return;
    }
    if (isFutureDate) {
      toast({ title: "Invalid date", description: "Payment date cannot be in the future.", variant: "destructive" });
      return;
    }
    if (preview.unapplied > 0.01) {
      toast({
        title: "Amount exceeds outstanding",
        description: `Only ${k(preview.outstandingBefore)} is outstanding. Reduce the amount.`,
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleConfirm = () => {
    const target = touchedLines[0] ?? payable[0];
    if (!target) return;
    onConfirm({
      repaymentId: target.id,
      amount: numAmount,
      penaltyAmount: penaltyAllocation,
      paymentMethod,
      accountId,
      paidDate: format(paidDate, "yyyy-MM-dd"),
      transactionReference: reference.trim() || undefined,
    });
  };

  const fillExact = () => setAmount(String(preview.outstandingBefore));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Guided payment {step === 2 && "· review"}
          </DialogTitle>
          <DialogDescription>
            {borrowerName ? `${borrowerName} — ` : ""}
            {payable.length} open installment{payable.length === 1 ? "" : "s"} · outstanding{" "}
            <strong>{k(preview.outstandingBefore)}</strong>
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="gp-amount">Amount received (K) *</Label>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={fillExact}>
                  Pay full balance
                </Button>
              </div>
              <Input
                id="gp-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={preview.unapplied > 0.01 ? "border-destructive" : ""}
                autoFocus
              />
              {preview.unapplied > 0.01 ? (
                <p className="text-xs text-destructive">
                  {k(preview.unapplied)} cannot be applied — exceeds outstanding {k(preview.outstandingBefore)}.
                </p>
              ) : totalPenaltyDue > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Penalty {k(Math.min(numAmount, totalPenaltyDue))} settled first, then principal.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Applied to the earliest open installment first.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", isFutureDate && "border-destructive")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(paidDate, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paidDate}
                      onSelect={(d) => d && setPaidDate(d)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Credit to account *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className={!accountId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gp-ref">Reference (receipt / deposit no.)</Label>
              <Input
                id="gp-ref"
                placeholder="e.g. Zanaco RCPT 542987"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Live allocation preview */}
            {numAmount > 0 && touchedLines.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Live preview</p>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {touchedLines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        #{l.installmentNumber}
                        <Badge
                          variant={l.newStatus === "paid" ? "default" : "outline"}
                          className="h-4 px-1.5 text-[10px] capitalize"
                        >
                          {l.newStatus}
                        </Badge>
                      </span>
                      <span className="tabular-nums">
                        +{k(l.principalApplied + l.penaltyApplied)}
                        {l.principalRemainingAfter + l.penaltyRemainingAfter > 0.01 && (
                          <span className="text-muted-foreground"> · {k(l.principalRemainingAfter + l.penaltyRemainingAfter)} left</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <span className="text-muted-foreground">Outstanding after</span>
                  <span className="font-semibold tabular-nums">{k(preview.outstandingAfter)}</span>
                </div>
                {preview.willComplete && (
                  <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Loan will be marked completed 🎉
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Total payment</p>
                <p className="font-bold">{k(numAmount)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Outstanding after</p>
                <p className="font-bold">{k(preview.outstandingAfter)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">To principal</p>
                <p className="font-medium">{k(preview.principalApplied)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">To penalties</p>
                <p className="font-medium">{k(preview.penaltyApplied)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">
                {paymentMethod.replace(/_/g, " ")} · {format(paidDate, "dd MMM yyyy")}
                {reference ? ` · ${reference}` : ""}
              </p>
              <p>
                Updates {touchedLines.length} installment{touchedLines.length === 1 ? "" : "s"}
                {touchedLines.filter((l) => l.newStatus === "paid").length > 0 &&
                  ` · ${touchedLines.filter((l) => l.newStatus === "paid").length} fully paid`}
              </p>
            </div>
            {preview.willComplete && (
              <div className="flex items-center gap-1.5 rounded-lg bg-success/10 p-3 text-sm text-success font-medium">
                <CheckCircle2 className="h-4 w-4" /> This payment closes the loan.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!canProceed}>
                Review <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? "Recording…" : `Record ${k(numAmount)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
