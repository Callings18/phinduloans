import { useEffect, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateLoan } from "@/utils/loanCalculations";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  loan: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

const EDITABLE_STATUSES = new Set(["pending", "under_review", "approved"]);

export default function EditPendingLoanDialog({ loan, open, onOpenChange, onSaved }: Props) {
  const qc = useQueryClient();
  const editable = loan && EDITABLE_STATUSES.has(loan.status);

  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [purpose, setPurpose] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState("");

  useEffect(() => {
    if (!open || !loan) return;
    setAmount(String(loan.loan_amount ?? ""));
    setTermMonths(String(loan.loan_term_months ?? ""));
    setPurpose(loan.loan_purpose ?? "");
    setCollateralDescription(loan.collateral_description ?? "");
    setCollateralValue(loan.collateral_value ? String(loan.collateral_value) : "");
  }, [open, loan]);

  const save = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan");
      if (!editable) throw new Error("Loan can no longer be edited at this stage");
      const amt = Number(amount);
      const term = Number(termMonths);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (!Number.isFinite(term) || term <= 0) throw new Error("Enter a valid term");

      // Recompute totals from the linked product so totals stay consistent.
      let totals: { totalRepayment: number; monthlyPayment: number } | null = null;
      try {
        const { data: product } = await supabase
          .from("loan_products")
          .select("*")
          .eq("id", loan.loan_product_id)
          .maybeSingle();
        if (product) {
          const calc = calculateLoan(
            amt,
            term,
            product as any,
            ((product as any).term_unit ?? loan.term_unit ?? "months") as any,
          );
          totals = {
            totalRepayment: calc.totalRepayment,
            monthlyPayment: calc.monthlyPayment,
          };
        }
      } catch {
        /* fall through — totals stay as-is if calc fails */
      }

      const update: Record<string, any> = {
        loan_amount: amt,
        loan_term_months: term,
        loan_purpose: purpose || null,
        collateral_description: collateralDescription || null,
        collateral_value: collateralValue ? Number(collateralValue) : null,
      };
      if (totals) {
        update.total_repayment = totals.totalRepayment;
        update.monthly_payment = totals.monthlyPayment;
      }

      const { error } = await supabase
        .from("loan_applications")
        .update(update)
        .eq("id", loan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan updated");
      qc.invalidateQueries({ queryKey: ["admin-active-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-all-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["house-loans"] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit loan application</DialogTitle>
          <DialogDescription>
            Update key fields before approval / disbursement. Totals recalculate automatically.
          </DialogDescription>
        </DialogHeader>

        {!editable && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This loan is at status <strong>{loan?.status}</strong> and can no longer be edited here.
              Use Restructure or Top-Up instead.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount">Loan amount (K)</Label>
            <Input
              id="edit-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-term">Term ({loan?.term_unit || "months"})</Label>
            <Input
              id="edit-term"
              type="number"
              min={1}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              disabled={!editable}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-purpose">Loan purpose</Label>
          <Textarea
            id="edit-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            disabled={!editable}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-coll-desc">Collateral description</Label>
            <Input
              id="edit-coll-desc"
              value={collateralDescription}
              onChange={(e) => setCollateralDescription(e.target.value)}
              disabled={!editable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-coll-val">Collateral value (K)</Label>
            <Input
              id="edit-coll-val"
              type="number"
              min={0}
              step="0.01"
              value={collateralValue}
              onChange={(e) => setCollateralValue(e.target.value)}
              disabled={!editable}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!editable || save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
