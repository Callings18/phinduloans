import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecordHousePaymentValue {
  amount: number;
  paymentMethod: string;
  accountId: string;
  paidDate: string; // ISO yyyy-MM-dd
  transactionReference?: string;
  notes?: string;
}

interface RecordHousePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repayment: {
    id: string;
    amount: number;
    due_date: string;
    installment_number?: number;
  } | null;
  borrowerName?: string;
  defaultPaymentMethod?: string;
  defaultAccountId?: string;
  isSubmitting?: boolean;
  onSubmit: (value: RecordHousePaymentValue) => void;
}

export function RecordHousePaymentDialog({
  open,
  onOpenChange,
  repayment,
  borrowerName,
  defaultPaymentMethod = "cash",
  defaultAccountId = "",
  isSubmitting,
  onSubmit,
}: RecordHousePaymentDialogProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidDate, setPaidDate] = useState<Date>(new Date());

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name, account_type")
        .eq("is_active", true)
        .order("account_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open && repayment) {
      setAmount(String(repayment.amount));
      setPaymentMethod(defaultPaymentMethod);
      setAccountId(defaultAccountId);
      setTransactionReference("");
      setNotes("");
      setPaidDate(new Date());
    }
  }, [open, repayment, defaultPaymentMethod, defaultAccountId]);

  const maxAmount = Number(repayment?.amount || 0);
  const numAmount = Number(amount);
  const exceedsOutstanding = numAmount > maxAmount + 0.001;
  const todayStart = new Date();
  todayStart.setHours(23, 59, 59, 999);
  const isFutureDate = paidDate > todayStart;

  const handleSubmit = () => {
    if (!numAmount || numAmount <= 0) {
      toast({ title: "Invalid amount", description: "Enter an amount greater than zero.", variant: "destructive" });
      return;
    }
    if (!accountId) {
      toast({ title: "Account required", description: "Select the account to credit.", variant: "destructive" });
      return;
    }
    if (exceedsOutstanding) {
      toast({
        title: "Amount exceeds outstanding",
        description: `Maximum allowed for this installment is K${maxAmount.toLocaleString()}. Adjust the amount and try again.`,
        variant: "destructive",
      });
      return;
    }
    if (isFutureDate) {
      toast({ title: "Invalid payment date", description: "Payment date cannot be in the future.", variant: "destructive" });
      return;
    }
    onSubmit({
      amount: numAmount,
      paymentMethod,
      accountId,
      paidDate: format(paidDate, "yyyy-MM-dd"),
      transactionReference: transactionReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const isOverdue = repayment ? repayment.due_date < format(new Date(), "yyyy-MM-dd") : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {borrowerName ? `${borrowerName} — ` : ""}
            Installment #{repayment?.installment_number ?? "—"}
            {repayment?.due_date && (
              <>
                {" "}
                due {format(new Date(repayment.due_date), "dd MMM yyyy")}
                {isOverdue && <span className="text-destructive"> (overdue)</span>}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp-amount">Amount (K) *</Label>
            <Input
              id="rp-amount"
              type="number"
              min="0"
              max={maxAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={exceedsOutstanding ? "border-destructive" : ""}
              autoFocus
            />
            {exceedsOutstanding ? (
              <p className="text-xs text-destructive">
                Cannot exceed outstanding K{maxAmount.toLocaleString()} for this installment.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Scheduled / outstanding: K{maxAmount.toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Payment date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    isFutureDate && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(paidDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidDate}
                  onSelect={(d) => d && setPaidDate(d)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {isFutureDate ? (
              <p className="text-xs text-destructive">Payment date cannot be in the future.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Defaults to today. Change to backdate the payment.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-method">Payment method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="rp-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-account">Credit to account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger
                id="rp-account"
                className={!accountId ? "border-destructive" : ""}
              >
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-ref">Transaction reference</Label>
            <Input
              id="rp-ref"
              placeholder="e.g. MPESA ref, cheque no."
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-notes">Notes (optional)</Label>
            <Textarea
              id="rp-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !accountId || !Number(amount) || exceedsOutstanding || isFutureDate}
          >
            {isSubmitting ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
