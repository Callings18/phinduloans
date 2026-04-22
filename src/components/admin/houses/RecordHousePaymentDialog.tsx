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

export interface RecordHousePaymentValue {
  amount: number;
  paymentMethod: string;
  accountId: string;
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
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");

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
    }
  }, [open, repayment, defaultPaymentMethod, defaultAccountId]);

  const handleSubmit = () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;
    if (!accountId) return;
    onSubmit({
      amount: numAmount,
      paymentMethod,
      accountId,
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
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Scheduled: K{Number(repayment?.amount || 0).toLocaleString()}
            </p>
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
            disabled={isSubmitting || !accountId || !Number(amount)}
          >
            {isSubmitting ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
