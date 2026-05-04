import { useEffect, useMemo, useState } from "react";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateLoan } from "@/utils/loanCalculations";
import { Loader2, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  loan: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

const EDITABLE_STATUSES = new Set(["pending", "under_review", "approved"]);

// Product-specific server-side rules enforced by enforce_house_product_rules().
// Mirroring them client-side prevents the user from typing values the DB will reject.
type ProductLock = {
  fixedAmount?: { min: number; max: number };
  fixedTerm?: { value: number; unit: string };
  note: string;
};

function getProductLock(productCode: string | null | undefined): ProductLock | null {
  switch ((productCode || "").toUpperCase()) {
    case "COLLATERAL":
      return {
        fixedTerm: { value: 6, unit: "months" },
        note: "Collateral loans are fixed at 6 months / 30% total interest. Term cannot be changed.",
      };
    case "PAYDAY_SOFT":
      return {
        fixedTerm: { value: 30, unit: "days" },
        note: "Payday Soft loans are fixed at 30 days. Term cannot be changed.",
      };
    case "MARKETEER":
      return {
        fixedAmount: { min: 1000, max: 10000 },
        fixedTerm: { value: 26, unit: "days" },
        note: "Marketeer loans are fixed at 26 collection days, K1,000 – K10,000.",
      };
    case "MOTOR_VEHICLE":
      return {
        note: "Motor Vehicle term must be between 3 and 24 months.",
      };
    default:
      return null;
  }
}

export default function EditPendingLoanDialog({ loan, open, onOpenChange, onSaved }: Props) {
  const qc = useQueryClient();
  const editable = loan && EDITABLE_STATUSES.has(loan.status);

  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [purpose, setPurpose] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState("");

  // Load the linked product so we can drive product-aware UI locks.
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["edit-pending-loan-product", loan?.loan_product_id],
    enabled: !!open && !!loan?.loan_product_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("*")
        .eq("id", loan.loan_product_id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const lock = useMemo(() => getProductLock(product?.product_code), [product?.product_code]);
  const termLocked = !!lock?.fixedTerm;

  useEffect(() => {
    if (!open || !loan) return;
    setAmount(String(loan.loan_amount ?? ""));
    setTermMonths(String(loan.loan_term_months ?? ""));
    setPurpose(loan.loan_purpose ?? "");
    setCollateralDescription(loan.collateral_description ?? "");
    setCollateralValue(loan.collateral_value ? String(loan.collateral_value) : "");
  }, [open, loan]);

  // When the product loads and has a hard-fixed term, force the displayed term to match.
  useEffect(() => {
    if (lock?.fixedTerm) {
      setTermMonths(String(lock.fixedTerm.value));
    }
  }, [lock?.fixedTerm?.value, lock?.fixedTerm?.unit]);

  const save = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan");
      if (!editable) throw new Error("Loan can no longer be edited at this stage");
      const amt = Number(amount);
      const term = Number(termMonths);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (!Number.isFinite(term) || term <= 0) throw new Error("Enter a valid term");

      // Pre-flight product-rule guards so the user gets a friendly message
      // instead of a raw Postgres exception from enforce_house_product_rules().
      if (lock?.fixedAmount) {
        const { min, max } = lock.fixedAmount;
        if (amt < min || amt > max) {
          throw new Error(`Amount must be between K${min.toLocaleString()} and K${max.toLocaleString()}`);
        }
      }
      if (lock?.fixedTerm && term !== lock.fixedTerm.value) {
        throw new Error(`Term is fixed at ${lock.fixedTerm.value} ${lock.fixedTerm.unit} for this product`);
      }

      // Recompute totals from the linked product so totals stay consistent.
      let totals: { totalRepayment: number; monthlyPayment: number } | null = null;
      if (product) {
        try {
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
        } catch {
          /* fall through — totals stay as-is if calc fails */
        }
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

        {lock && editable && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{lock.note}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount">
              Loan amount (K)
              {lock?.fixedAmount && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (K{lock.fixedAmount.min.toLocaleString()} – K{lock.fixedAmount.max.toLocaleString()})
                </span>
              )}
            </Label>
            <Input
              id="edit-amount"
              type="number"
              min={lock?.fixedAmount?.min ?? 0}
              max={lock?.fixedAmount?.max ?? undefined}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!editable || productLoading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-term">
              Term ({lock?.fixedTerm?.unit || product?.term_unit || loan?.term_unit || "months"})
              {termLocked && <span className="ml-1 text-xs text-muted-foreground">(fixed)</span>}
            </Label>
            <Input
              id="edit-term"
              type="number"
              min={1}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              disabled={!editable || termLocked || productLoading}
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
