import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/utils/auditLog";
import { calculateLoan } from "@/utils/loanCalculations";
import {
  calculateMarketeerLoan,
  getMarketeerTiersOrDefault,
} from "@/lib/marketeerCalculations";
import { useProductLoanRules } from "@/hooks/useProductLoanRules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, User, MapPin, Briefcase, Save, Loader2, Users } from "lucide-react";
import CollateralBorrowersSection, {
  type CollateralBorrowerEntry,
  makeBlankBorrower,
  validateCollateralBorrowers,
} from "@/components/loans/CollateralBorrowersSection";

interface PendingLoan {
  id: string;
  user_id: string;
  status: string;
  loan_product_id: string | null;
  loan_amount: number;
  loan_term_months: number;
  term_unit?: string | null;
  loan_purpose: string | null;
  monthly_income: number | null;
  employment_type: string | null;
  employer_name: string | null;
  job_title: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
  admin_notes: string | null;
  product_specific_data?: any;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  total_repayment?: number | null;
}

interface Props {
  loan: PendingLoan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional: signal callers to refetch their lists
  onSaved?: () => void;
}

type EditableLoanStatus = "pending" | "under_review" | "pmic_pending" | "crb_failed";

const EDITABLE_STATUSES = new Set<EditableLoanStatus>([
  "pending",
  "under_review",
  "pmic_pending",
  "crb_failed",
]);

/**
 * EditPendingLoanDialog
 *
 * Lets admins/loan officers update a Pending loan after it has been created.
 * Common reasons:
 *   - Borrower changed the requested amount or term
 *   - Address / employment / income captured incorrectly
 *   - For COLLATERAL: a co-borrower or absolute owner needs to be added,
 *     edited or removed before approval
 *
 * Once a loan is approved/disbursed/active, this dialog refuses to save —
 * post-approval changes go through the Restructure flow.
 */
export default function EditPendingLoanDialog({ loan, open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Loan-level fields -------------------------------------------------
  const [loanAmount, setLoanAmount] = useState("");
  const [termValue, setTermValue] = useState("");
  const [loanPurpose, setLoanPurpose] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employmentType, setEmploymentType] = useState<string>("employed");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // ---- Borrower contact / address (the snapshot stored on the loan) ------
  const [contactNumber, setContactNumber] = useState("");
  const [nrcNumber, setNrcNumber] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [city, setCity] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // ---- Marketeer-specific ------------------------------------------------
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessMonths, setBusinessMonths] = useState("0");
  const [hasLocalAuthorityCompliance, setHasLocalAuthorityCompliance] = useState(false);

  // ---- Collateral multi-borrower ----------------------------------------
  const [primaryBorrowerEntry, setPrimaryBorrowerEntry] = useState<CollateralBorrowerEntry>(() =>
    makeBlankBorrower("PRIMARY_BORROWER"),
  );
  const [coBorrowerEntries, setCoBorrowerEntries] = useState<CollateralBorrowerEntry[]>([]);
  const [absoluteOwnerEntries, setAbsoluteOwnerEntries] = useState<CollateralBorrowerEntry[]>([]);

  const productCode = (loan?.product_specific_data?.product_code || "").toUpperCase();

  // Fetch loan product so we can use accurate min/max + interest config
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["loan-product-edit", loan?.loan_product_id],
    queryFn: async () => {
      if (!loan?.loan_product_id) return null;
      const { data, error } = await supabase
        .from("loan_products")
        .select(
          "id, name, product_code, min_amount, max_amount, min_term_months, max_term_months, interest_rate, interest_period, interest_type, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent, term_unit, pricing_tiers"
        )
        .eq("id", loan.loan_product_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loan?.loan_product_id && open,
  });

  const isCollateral = productCode === "COLLATERAL" || (product?.product_code || "").toUpperCase() === "COLLATERAL";
  const isMarketeer = productCode === "MARKETEER" || (product?.product_code || "").toUpperCase() === "MARKETEER";

  // Validation rules with product-specific limits
  const rules = useProductLoanRules(
    (productCode || product?.product_code || "BUSINESS") as any,
    {
      min_amount: (product as any)?.min_amount,
      max_amount: (product as any)?.max_amount,
    },
  );

  // Pre-fill state when loan changes / dialog opens
  useEffect(() => {
    if (!loan || !open) return;
    setLoanAmount(String(loan.loan_amount ?? ""));
    setTermValue(String(loan.loan_term_months ?? ""));
    setLoanPurpose(loan.loan_purpose ?? "");
    setMonthlyIncome(String(loan.monthly_income ?? ""));
    setEmploymentType(loan.employment_type ?? "employed");
    setEmployerName(loan.employer_name ?? "");
    setJobTitle(loan.job_title ?? "");
    setContactNumber(loan.phone ?? "");
    setNrcNumber(loan.nrc_number ?? "");
    setResidentialAddress(loan.address ?? "");
    setCity(loan.city ?? "");
    setAdminNotes(loan.admin_notes ?? "");

    const psd = loan.product_specific_data || {};
    setBusinessAddress(psd.business_address ?? "");
    setBusinessMonths(String(psd.business_months ?? 0));
    setHasLocalAuthorityCompliance(Boolean(psd.local_authority_compliance));
  }, [loan, open]);

  // Load existing collateral borrowers for COLLATERAL loans
  useEffect(() => {
    if (!loan?.id || !open || !isCollateral) return;
    (async () => {
      const { data } = await (supabase.from as any)("loan_borrowers")
        .select("id, customer_id, full_name, nrc_number, phone, address, role, is_signatory")
        .eq("loan_application_id", loan.id);
      if (!data || data.length === 0) return;

      const mapEntry = (r: any): CollateralBorrowerEntry => ({
        uid: r.id,
        customer_id: r.customer_id,
        full_name: r.full_name || "",
        nrc_number: r.nrc_number || "",
        phone: r.phone || "",
        address: r.address || "",
        role: r.role,
        is_signatory: !!r.is_signatory,
      });

      const primary = data.find((r: any) => r.role === "PRIMARY_BORROWER");
      const cos = data.filter((r: any) => r.role === "CO_BORROWER").map(mapEntry);
      const owners = data.filter((r: any) => r.role === "ABSOLUTE_OWNER").map(mapEntry);

      if (primary) {
        setPrimaryBorrowerEntry(mapEntry(primary));
      } else {
        // No row yet — synthesize from the loan snapshot
        setPrimaryBorrowerEntry({
          uid: `synthetic-${loan.id}`,
          customer_id: loan.user_id,
          full_name: loan.full_name || "",
          nrc_number: loan.nrc_number || "",
          phone: loan.phone || "",
          address: loan.address || "",
          role: "PRIMARY_BORROWER",
          is_signatory: true,
        });
      }
      setCoBorrowerEntries(cos);
      setAbsoluteOwnerEntries(owners);
    })();
  }, [loan?.id, open, isCollateral, loan?.user_id, loan?.full_name, loan?.nrc_number, loan?.phone, loan?.address]);

  const validationErrors = useMemo(() => {
    if (!loan) return [];
    return rules.validate({
      employmentType: (employmentType as any) || "employed",
      city,
      loanAmount: Number(loanAmount || 0),
      termValue: Number(termValue || 0),
      businessMonths: Number(businessMonths || 0),
      isCivilServantConfirmed: Boolean(loan.product_specific_data?.civil_servant_confirmed),
      hasLocalAuthorityCompliance,
    });
  }, [rules, loan, employmentType, city, loanAmount, termValue, businessMonths, hasLocalAuthorityCompliance]);

  const collateralValidation = useMemo(() => {
    if (!isCollateral) {
      return { isValid: true, errors: [] as string[], warnings: [] as string[], signatoryCount: 0 };
    }
    return validateCollateralBorrowers(primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries);
  }, [isCollateral, primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries]);

  const editable = !!loan && EDITABLE_STATUSES.has(loan.status as EditableLoanStatus);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan selected");
      if (!editable) {
        throw new Error("Only loans in Pending review can be edited. Use Restructure for approved loans.");
      }
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);
      if (isCollateral && !collateralValidation.isValid) {
        throw new Error(collateralValidation.errors[0] || "Borrowers section incomplete.");
      }

      const principal = Number(loanAmount);
      const termNum = Number(termValue);
      if (!Number.isFinite(principal) || principal <= 0) {
        throw new Error("Loan amount must be greater than 0");
      }
      if (!Number.isFinite(termNum) || termNum <= 0) {
        throw new Error("Loan term must be greater than 0");
      }

      // Recalculate totals so they remain consistent with the new amount/term.
      let totalRepayment = Number(loan.total_repayment || 0);
      let installmentAmount = Number(loan.monthly_payment || 0);

      if (isMarketeer && product) {
        const tiers = getMarketeerTiersOrDefault((product as any).pricing_tiers);
        const m = calculateMarketeerLoan(principal, tiers);
        if (!m) throw new Error("Marketeer calculation failed for the entered amount");
        totalRepayment = m.totalRepayment;
        installmentAmount = m.dailyInstallment;
      } else if (product) {
        const calc = calculateLoan(
          principal,
          termNum,
          {
            product_code: product.product_code as any,
            interest_rate: Number(product.interest_rate || 0),
            interest_period: ((product as any).interest_period || "monthly") as any,
            interest_type: ((product as any).interest_type || "flat") as any,
            processing_fee_percent: Number((product as any).processing_fee_percent || 0),
            enforcement_fee_percent: Number((product as any).enforcement_fee_percent || 0),
            insurance_percent: Number((product as any).insurance_percent || 0),
            vat_percent: Number((product as any).vat_percent || 0),
            platform_fee_percent: Number((product as any).platform_fee_percent || 0),
          },
          ((product as any).term_unit || loan.term_unit || "months") as any,
        );
        totalRepayment = calc.totalRepayment;
        installmentAmount = calc.monthlyPayment || calc.weeklyPayment || calc.dailyPayment || 0;
      }

      const updatedPSD = {
        ...(loan.product_specific_data || {}),
        business_months: Number(businessMonths || 0),
        local_authority_compliance: hasLocalAuthorityCompliance,
        business_address: businessAddress,
        residential_address: residentialAddress,
        contact_number: contactNumber,
      };

      const { error: loanErr } = await supabase
        .from("loan_applications")
        .update({
          loan_amount: principal,
          loan_term_months: termNum,
          loan_purpose: loanPurpose || null,
          monthly_income: Number(monthlyIncome) || loan.monthly_income,
          employment_type: employmentType as any,
          employer_name: employerName || null,
          job_title: jobTitle || null,
          full_name: primaryBorrowerEntry.full_name?.trim() || loan.full_name,
          phone: contactNumber || loan.phone || "",
          nrc_number: nrcNumber || loan.nrc_number || "",
          address: residentialAddress || null,
          city: city || null,
          admin_notes: adminNotes || null,
          monthly_payment: installmentAmount,
          total_repayment: totalRepayment,
          product_specific_data: updatedPSD,
        })
        .eq("id", loan.id)
        .in("status", Array.from(EDITABLE_STATUSES));
      if (loanErr) throw loanErr;

      // Replace the collateral borrower roster atomically: delete then insert.
      if (isCollateral) {
        const { error: delErr } = await (supabase.from as any)("loan_borrowers")
          .delete()
          .eq("loan_application_id", loan.id);
        if (delErr) throw delErr;

        const rows = [
          {
            loan_application_id: loan.id,
            customer_id: primaryBorrowerEntry.customer_id || loan.user_id,
            full_name: primaryBorrowerEntry.full_name,
            nrc_number: primaryBorrowerEntry.nrc_number,
            phone: primaryBorrowerEntry.phone || null,
            address: primaryBorrowerEntry.address || null,
            role: "PRIMARY_BORROWER" as const,
            is_signatory: primaryBorrowerEntry.is_signatory,
            created_by: user?.id ?? null,
          },
          ...coBorrowerEntries.map((b) => ({
            loan_application_id: loan.id,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "CO_BORROWER" as const,
            is_signatory: b.is_signatory,
            created_by: user?.id ?? null,
          })),
          ...absoluteOwnerEntries.map((b) => ({
            loan_application_id: loan.id,
            customer_id: b.customer_id || null,
            full_name: b.full_name,
            nrc_number: b.nrc_number,
            phone: b.phone || null,
            address: b.address || null,
            role: "ABSOLUTE_OWNER" as const,
            is_signatory: b.is_signatory,
            created_by: user?.id ?? null,
          })),
        ];
        const { error: insErr } = await (supabase.from as any)("loan_borrowers").insert(rows);
        if (insErr) throw insErr;
      }

      await logAudit({
        action: "PENDING_LOAN_EDITED",
        entity_type: "loan_application",
        entity_id: loan.id,
        module: "loans",
        new_values: {
          loan_amount: principal,
          loan_term_months: termNum,
          loan_purpose: loanPurpose,
          city,
          employment_type: employmentType,
          collateral_borrowers: isCollateral
            ? {
                co_borrowers: coBorrowerEntries.length,
                absolute_owners: absoluteOwnerEntries.length,
              }
            : undefined,
        },
      });
    },
    onSuccess: () => {
      toast({ title: "Loan updated", description: "Pending loan saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-portfolio-loans"] });
      queryClient.invalidateQueries({ queryKey: ["house-loans"] });
      queryClient.invalidateQueries({ queryKey: ["house-loan-borrowers", loan?.id] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not update loan", description: err.message, variant: "destructive" });
    },
  });

  if (!loan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User size={20} /> Edit Pending Loan
            <Badge variant="outline" className="ml-2 capitalize">{loan.status?.replace(/_/g, " ")}</Badge>
          </DialogTitle>
          <DialogDescription>
            {editable
              ? "Update loan details before approval. Changes here recalculate the repayment totals."
              : "This loan has moved past Pending review. Use Restructure for approved loans."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="loan" className="space-y-3">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="loan" className="text-xs">Loan & Purpose</TabsTrigger>
            <TabsTrigger value="customer" className="text-xs">Customer & Address</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs">Employment</TabsTrigger>
            {isCollateral && <TabsTrigger value="parties" className="text-xs">Co-Borrowers & Owners</TabsTrigger>}
          </TabsList>

          {/* ===== Loan tab ===== */}
          <TabsContent value="loan" className="space-y-3 mt-0">
            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loan Amount (K) *</Label>
                    <Input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      min={(product as any)?.min_amount ?? 0}
                      max={(product as any)?.max_amount ?? undefined}
                    />
                    {(product as any)?.min_amount && (product as any)?.max_amount && (
                      <p className="text-[10px] text-muted-foreground">
                        Allowed: K{Number((product as any).min_amount).toLocaleString()} – K{Number((product as any).max_amount).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Term ({(product as any)?.term_unit || loan.term_unit || "months"}) *</Label>
                    <Input
                      type="number"
                      value={termValue}
                      onChange={(e) => setTermValue(e.target.value)}
                      disabled={isMarketeer}
                    />
                    {isMarketeer && (
                      <p className="text-[10px] text-muted-foreground">Fixed at 26 collection days for Marketeer.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Purpose</Label>
                    <Input value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Admin Notes</Label>
                  <Textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes about this application..."
                  />
                </div>

                {validationErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        {validationErrors.map((e) => (
                          <p key={e} className="text-xs text-destructive">{e}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Customer tab ===== */}
          <TabsContent value="customer" className="space-y-3 mt-0">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Contact & Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contact Number</Label>
                    <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">NRC Number</Label>
                    <Input value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value)} placeholder="123456/78/9" />
                  </div>
                  {isMarketeer && (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Business Address</Label>
                      <Input
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="Market stall / stand number"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Residential Address</Label>
                    <Input value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">City / Town</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Employment tab ===== */}
          <TabsContent value="employment" className="space-y-3 mt-0">
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Employment / Income</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employment Type</Label>
                    <Select value={employmentType} onValueChange={setEmploymentType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employed">Employed</SelectItem>
                        <SelectItem value="self_employed">Self-employed / Business Owner</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monthly Income (K)</Label>
                    <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
                  </div>
                  {!isMarketeer && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Employer Name</Label>
                        <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Job Title</Label>
                        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                      </div>
                    </>
                  )}
                  {isMarketeer && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Business Age (months)</Label>
                      <Input
                        type="number"
                        value={businessMonths}
                        onChange={(e) => setBusinessMonths(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Collateral parties tab ===== */}
          {isCollateral && (
            <TabsContent value="parties" className="space-y-3 mt-0">
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Borrower & Owner Parties</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <CollateralBorrowersSection
                    primary={primaryBorrowerEntry}
                    coBorrowers={coBorrowerEntries}
                    absoluteOwners={absoluteOwnerEntries}
                    onPrimaryChange={setPrimaryBorrowerEntry}
                    onCoBorrowersChange={setCoBorrowerEntries}
                    onAbsoluteOwnersChange={setAbsoluteOwnerEntries}
                    primaryLocked={false}
                  />
                  {!collateralValidation.isValid && (
                    <p className="text-xs text-destructive mt-2">
                      Fix {collateralValidation.errors.length} borrower issue
                      {collateralValidation.errors.length === 1 ? "" : "s"} above before saving.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={
              !editable ||
              productLoading ||
              updateMutation.isPending ||
              validationErrors.length > 0 ||
              (isCollateral && !collateralValidation.isValid)
            }
          >
            {updateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
