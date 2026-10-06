import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Skeleton } from "@phinduloans/shared/components/ui/skeleton";
import { Button } from "@phinduloans/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@phinduloans/shared/components/ui/dialog";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Label } from "@phinduloans/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@phinduloans/shared/components/ui/select";
import { Textarea } from "@phinduloans/shared/components/ui/textarea";
import { useToast } from "@phinduloans/shared/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { invalidateLoanProductQueries } from "@/lib/invalidateLoanProductQueries";
import {
  Percent,
  Scale,
  MapPin,
  Banknote,
  Clock,
  ShieldAlert,
  Pencil,
} from "lucide-react";
import { computeUpfrontProductFees } from "@phinduloans/shared/utils/loanCalculations";

const PERIOD_LABEL: Record<string, string> = {
  per_day: "/ day",
  per_week: "/ week",
  per_month: "/ month",
  per_year: "/ year",
  per_loan: "/ loan",
  monthly: "/ month",
  daily: "/ day",
  weekly: "/ week",
  yearly: "/ year",
};

const DEDUCTION_LABEL: Record<string, string> = {
  upfront_net: "Upfront (net disbursement)",
  added_to_repayment: "Added to repayment",
  none: "None",
};

const SELECT_COLS =
  "name, interest_rate, interest_period, legal_fee_percent, legal_fee_deduction_mode, processing_fee_percent, late_payment_penalty_percent, late_fee_fixed_amount, min_amount, max_amount, min_term_months, max_term_months, term_unit, eligible_locations";

type ProductRow = {
  name: string | null;
  interest_rate: number | null;
  interest_period: string | null;
  legal_fee_percent: number | null;
  legal_fee_deduction_mode: string | null;
  processing_fee_percent: number | null;
  late_payment_penalty_percent: number | null;
  late_fee_fixed_amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  min_term_months: number | null;
  max_term_months: number | null;
  term_unit: string | null;
  eligible_locations: string[] | null;
};

export default function HouseProductConfigCard({ productCode }: { productCode: string }) {
  const { can, hasRole } = usePermissions();
  const canEdit = hasRole("admin") || can("products", "update");
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["house-product-config", productCode],
    enabled: Boolean(productCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select(SELECT_COLS)
        .eq("product_code", productCode)
        .maybeSingle();
      if (error) throw error;
      return data as ProductRow | null;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Product configuration</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const periodLabel = PERIOD_LABEL[data.interest_period as string] ?? "";
  const legalPct = Number(data.legal_fee_percent ?? 0);
  const legalMode = (data.legal_fee_deduction_mode as string) ?? "none";
  const procPct = Number(data.processing_fee_percent ?? 0);
  const lateFixed = data.late_fee_fixed_amount ? Number(data.late_fee_fixed_amount) : null;
  const latePct = Number(data.late_payment_penalty_percent ?? 0);
  const locations = (data.eligible_locations as string[] | null) ?? null;
  const termUnit = data.term_unit ?? "months";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Product configuration</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <Percent className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Interest</p>
              <p className="font-semibold">
                {Number(data.interest_rate ?? 0)}% <span className="text-xs text-muted-foreground">{periodLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Legal fee</p>
              <p className="font-semibold">{legalPct > 0 ? `${legalPct}%` : "Not set"}</p>
              <p className="text-xs text-muted-foreground">{DEDUCTION_LABEL[legalMode] ?? legalMode}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Processing fee</p>
              <p className="font-semibold">{procPct > 0 ? `${procPct}%` : "—"}</p>
              <p className="text-xs text-muted-foreground">Deducted from principal at disbursement</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Late fee</p>
              <p className="font-semibold text-destructive">
                {lateFixed ? `K${lateFixed.toLocaleString()}/day` : `${latePct}%`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Amount range</p>
              <p className="font-semibold">
                K{Number(data.min_amount ?? 0).toLocaleString()} – K{Number(data.max_amount ?? 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Term</p>
              <p className="font-semibold">
                {data.min_term_months}–{data.max_term_months} {termUnit}
              </p>
            </div>
          </div>

          {locations && locations.length > 0 ? (
            <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Eligible locations</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {locations.map((l) => (
                    <Badge key={l} variant="outline">{l}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {data.interest_period === "per_loan" ? (
          <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
            <span className="font-medium text-foreground">{Number(data.interest_rate ?? 0)}% flat interest</span> charged once on the principal — regardless of term.
            Split evenly across {data.min_term_months}{data.max_term_months !== data.min_term_months ? `–${data.max_term_months}` : ""} {termUnit} of equal installments.
          </p>
        ) : null}
        {legalPct > 0 && legalMode === "upfront_net" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Borrower receives loan amount minus {legalPct}% legal fee on disbursement, but repays the full amount.
          </p>
        ) : null}
      </CardContent>

      {canEdit && (
        <EditProductConfigDialog
          open={open}
          onOpenChange={setOpen}
          productCode={productCode}
          initial={data}
        />
      )}
    </Card>
  );
}

function EditProductConfigDialog({
  open,
  onOpenChange,
  productCode,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productCode: string;
  initial: ProductRow;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProductRow>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const num = (v: unknown) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const feePreview = useMemo(() => {
    const samplePrincipal = 10_000;
    return computeUpfrontProductFees(samplePrincipal, {
      processing_fee_percent: num(form.processing_fee_percent) ?? 0,
      enforcement_fee_percent: 0,
      insurance_percent: 0,
      vat_percent: 0,
      platform_fee_percent: 0,
      legal_fee_percent: num(form.legal_fee_percent) ?? 0,
      legal_fee_deduction_mode: form.legal_fee_deduction_mode ?? "none",
    });
  }, [form.processing_fee_percent, form.legal_fee_percent, form.legal_fee_deduction_mode]);

  const handleSave = async () => {
    // Basic validation
    if (form.min_term_months !== null && form.max_term_months !== null && form.min_term_months > form.max_term_months) {
      toast({ title: "Invalid term range", description: "Min term cannot exceed max term.", variant: "destructive" });
      return;
    }
    if (form.min_amount !== null && form.max_amount !== null && Number(form.min_amount) > Number(form.max_amount)) {
      toast({ title: "Invalid amount range", description: "Min amount cannot exceed max amount.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const locations = (form.eligible_locations ?? []).filter(Boolean);
    const payload = {
      interest_rate: num(form.interest_rate) ?? 0,
      interest_period: form.interest_period ?? "monthly",
      legal_fee_percent: num(form.legal_fee_percent) ?? 0,
      legal_fee_deduction_mode: form.legal_fee_deduction_mode ?? "none",
      processing_fee_percent: num(form.processing_fee_percent) ?? 0,
      late_payment_penalty_percent: num(form.late_payment_penalty_percent) ?? 0,
      late_fee_fixed_amount: num(form.late_fee_fixed_amount),
      min_amount: num(form.min_amount) ?? 0,
      max_amount: num(form.max_amount) ?? 0,
      min_term_months: num(form.min_term_months) ?? 1,
      max_term_months: num(form.max_term_months) ?? 1,
      term_unit: form.term_unit ?? "months",
      eligible_locations: locations.length > 0 ? locations : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("loan_products")
      .update(payload)
      .eq("product_code", productCode);

    setSaving(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Product updated", description: `${initial.name ?? productCode} configuration saved.` });
    qc.invalidateQueries({ queryKey: ["house-product-config", productCode] });
    qc.invalidateQueries({ queryKey: ["house-product", productCode] });
    qc.invalidateQueries({ queryKey: ["product-by-code", productCode] });
    invalidateLoanProductQueries(qc);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit product configuration</DialogTitle>
          <DialogDescription>
            Update {initial.name ?? productCode} settings. Changes apply immediately to new loans of this product.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <Label>Interest rate (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.interest_rate ?? ""}
              onChange={(e) => setForm({ ...form, interest_rate: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Interest period</Label>
            <Select
              value={form.interest_period ?? "monthly"}
              onValueChange={(v) => setForm({ ...form, interest_period: v })}
              disabled={productCode === "COLLATERAL"}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="per_loan">Per loan (total over loan)</SelectItem>
              </SelectContent>
            </Select>
            {productCode === "COLLATERAL" && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Locked to "Per loan" — Collateral charges 30% total once, regardless of term.
              </p>
            )}
          </div>

          <div>
            <Label>Legal fee (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.legal_fee_percent ?? ""}
              onChange={(e) => setForm({ ...form, legal_fee_percent: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Legal fee deduction</Label>
            <Select
              value={form.legal_fee_deduction_mode ?? "none"}
              onValueChange={(v) => setForm({ ...form, legal_fee_deduction_mode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="upfront_net">Upfront (net disbursement)</SelectItem>
                <SelectItem value="added_to_repayment">Added to repayment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Processing fee (%)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.processing_fee_percent ?? ""}
              onChange={(e) => setForm({ ...form, processing_fee_percent: num(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              % of loan principal withheld at disbursement (not added to repayment).
            </p>
          </div>
          <div>
            <Label>Late payment penalty (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.late_payment_penalty_percent ?? ""}
              onChange={(e) => setForm({ ...form, late_payment_penalty_percent: num(e.target.value) })}
            />
          </div>

          <div>
            <Label>Late fee fixed amount (K/day)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.late_fee_fixed_amount ?? ""}
              onChange={(e) => setForm({ ...form, late_fee_fixed_amount: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Term unit</Label>
            <Select
              value={form.term_unit ?? "months"}
              onValueChange={(v) => setForm({ ...form, term_unit: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="years">Years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Min amount (K)</Label>
            <Input
              type="number"
              value={form.min_amount ?? ""}
              onChange={(e) => setForm({ ...form, min_amount: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Max amount (K)</Label>
            <Input
              type="number"
              value={form.max_amount ?? ""}
              onChange={(e) => setForm({ ...form, max_amount: num(e.target.value) })}
            />
          </div>

          <div>
            <Label>Min term</Label>
            <Input
              type="number"
              value={form.min_term_months ?? ""}
              onChange={(e) => setForm({ ...form, min_term_months: num(e.target.value) })}
            />
          </div>
          <div>
            <Label>Max term</Label>
            <Input
              type="number"
              value={form.max_term_months ?? ""}
              onChange={(e) => setForm({ ...form, max_term_months: num(e.target.value) })}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Eligible locations (comma-separated, leave blank for all)</Label>
            <Textarea
              rows={2}
              value={(form.eligible_locations ?? []).join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  eligible_locations: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g. Lusaka, Kitwe, Ndola"
            />
          </div>
        </div>

        {Number(form.processing_fee_percent) > 0 || Number(form.legal_fee_percent) > 0 ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="text-xs font-medium text-foreground">Live preview (K10,000 principal)</p>
            {Number(form.processing_fee_percent) > 0 ? (
              <p className="text-muted-foreground">
                Processing fee ({Number(form.processing_fee_percent)}%):{" "}
                <span className="font-medium text-destructive">−K{feePreview.processingFee.toLocaleString()}</span>
              </p>
            ) : null}
            {feePreview.legalFeeAmount > 0 ? (
              <p className="text-muted-foreground">
                Legal fee: <span className="font-medium text-destructive">−K{feePreview.legalFeeAmount.toLocaleString()}</span>
              </p>
            ) : null}
            <p className="font-semibold text-success">
              Borrower receives: K{feePreview.netToBorrower.toLocaleString()}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
