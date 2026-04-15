import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan } from "@/utils/loanCalculations";
import { useProductLoanRules } from "@/hooks/useProductLoanRules";
import type { LoanProductCode } from "@/config/loanProductModules";
import { calculateMarketeerLoan, getMarketeerTiersOrDefault } from "@/lib/marketeerCalculations";

type Borrower = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  nrc_number: string | null;
  address: string | null;
  city: string | null;
  employer_name: string | null;
  employment_type: string | null;
  job_title: string | null;
  net_income: number | null;
};

interface ProductLoanFormShellProps {
  productCode: LoanProductCode;
  title: string;
  description: string;
  termUnit: "days" | "weeks" | "months";
  defaultTermValue: number;
  showChecklist?: boolean;
  successRedirectPath?: string;
}

export default function ProductLoanFormShell({
  productCode,
  title,
  description,
  termUnit,
  defaultTermValue,
  showChecklist = true,
  successRedirectPath = "/admin/applications",
}: ProductLoanFormShellProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rules = useProductLoanRules(productCode);

  const [borrowerId, setBorrowerId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [termValue, setTermValue] = useState(String(defaultTermValue));
  const [loanPurpose, setLoanPurpose] = useState("");
  const [employmentType, setEmploymentType] = useState<"employed" | "self_employed" | "contract" | "other">("employed");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("");
  const [businessMonths, setBusinessMonths] = useState("0");
  const [isCivilServantConfirmed, setIsCivilServantConfirmed] = useState(false);
  const [hasLocalAuthorityCompliance, setHasLocalAuthorityCompliance] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [uploadedDocMap, setUploadedDocMap] = useState<Record<string, boolean>>({});

  const { data: product } = useQuery({
    queryKey: ["product-by-code", productCode],
    queryFn: async () => {
      const fromAny = (supabase.from as any);
      const { data, error } = await fromAny("loan_products")
        .select("id, name, interest_rate, interest_period, interest_type, processing_fee_percent, enforcement_fee_percent, insurance_percent, vat_percent, platform_fee_percent, term_unit, pricing_tiers")
        .eq("product_code", productCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: borrowers } = useQuery({
    queryKey: ["product-loan-borrowers", productCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, nrc_number, address, city, employer_name, employment_type, job_title, net_income")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Borrower[];
    },
  });

  const selectedBorrower = useMemo(
    () => (borrowers || []).find((b) => b.id === borrowerId) || null,
    [borrowers, borrowerId]
  );

  const validationErrors = useMemo(
    () =>
      rules.validate({
        employmentType,
        city,
        loanAmount: Number(loanAmount || 0),
        termValue: Number(termValue || 0),
        businessMonths: Number(businessMonths || 0),
        isCivilServantConfirmed,
        hasLocalAuthorityCompliance,
      }),
    [rules, employmentType, city, loanAmount, termValue, businessMonths, isCivilServantConfirmed, hasLocalAuthorityCompliance]
  );

  const preview = useMemo(() => {
    if (!product || !loanAmount || !termValue) return null;
    const principal = Number(loanAmount || 0);
    if (principal <= 0) return null;

    if (productCode === "MARKETEER") {
      const tiers = getMarketeerTiersOrDefault((product as unknown as { pricing_tiers?: unknown }).pricing_tiers);
      const result = calculateMarketeerLoan(principal, tiers);
      if (!result) return null;
      return {
        repayment: result.totalRepayment,
        installmentLabel: `Daily installment (${result.durationDays} collection days, Sundays excluded)`,
        installment: result.dailyInstallment,
      };
    }

    const calc = calculateLoan(
      principal,
      Number(termValue),
      {
        product_code: productCode,
        interest_rate: Number(product.interest_rate || 0),
        interest_period: (product.interest_period || "monthly") as "daily" | "weekly" | "monthly" | "yearly",
        interest_type: ((product.interest_type as string) || "flat") as "flat" | "reducing",
        processing_fee_percent: Number(product.processing_fee_percent || 0),
        enforcement_fee_percent: Number(product.enforcement_fee_percent || 0),
        insurance_percent: Number(product.insurance_percent || 0),
        vat_percent: Number(product.vat_percent || 0),
        platform_fee_percent: Number(product.platform_fee_percent || 0),
      },
      termUnit
    );
    return {
      repayment: calc.totalRepayment,
      installmentLabel: "Installment",
      installment: calc.dailyPayment || calc.weeklyPayment || calc.monthlyPayment,
    };
  }, [product, loanAmount, termValue, productCode, termUnit]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower) throw new Error("Select a borrower first.");
      if (!product?.id) throw new Error("Loan product not found. Check product_code setup.");
      if (!user?.id) throw new Error("User session not found.");
      if (!loanAmount || !termValue || !loanPurpose || !monthlyIncome) {
        throw new Error("Fill in all required loan fields.");
      }
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);

      const calc = calculateLoan(
        Number(loanAmount),
        Number(termValue),
        {
          product_code: productCode,
          interest_rate: Number(product.interest_rate || 0),
          interest_period: (product.interest_period || "monthly") as "daily" | "weekly" | "monthly" | "yearly",
          interest_type: ((product.interest_type as string) || "flat") as "flat" | "reducing",
          processing_fee_percent: Number(product.processing_fee_percent || 0),
          enforcement_fee_percent: Number(product.enforcement_fee_percent || 0),
          insurance_percent: Number(product.insurance_percent || 0),
          vat_percent: Number(product.vat_percent || 0),
          platform_fee_percent: Number(product.platform_fee_percent || 0),
        },
        termUnit
      );

      const payload = {
        user_id: selectedBorrower.id,
        loan_product_id: product.id,
        full_name: selectedBorrower.full_name || selectedBorrower.email,
        email: selectedBorrower.email,
        phone: selectedBorrower.phone || "",
        nrc_number: selectedBorrower.nrc_number || "",
        address: selectedBorrower.address || null,
        city: city || selectedBorrower.city || null,
        employer_name: employerName || selectedBorrower.employer_name || null,
        job_title: jobTitle || selectedBorrower.job_title || null,
        employment_type: employmentType,
        monthly_income: Number(monthlyIncome),
        loan_amount: Number(loanAmount),
        loan_term_months: Number(termValue),
        term_unit: termUnit,
        loan_purpose: loanPurpose,
        interest_rate: Number(product.interest_rate || 0),
        monthly_payment: calc.monthlyPayment,
        total_repayment: calc.totalRepayment,
        admin_notes: adminNotes || null,
        source: "internal",
        status: "pending" as const,
        product_specific_data: {
          product_code: productCode,
          business_months: Number(businessMonths || 0),
          civil_servant_confirmed: isCivilServantConfirmed,
          local_authority_compliance: hasLocalAuthorityCompliance,
          uploaded_docs: uploadedDocMap,
          approvals: {
            loan_officer: { status: "pending" },
            finance: { status: "pending" },
            manager: { status: "pending" },
          },
        },
      };

      const { error } = await supabase.from("loan_applications").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast({ title: `${title} application created`, description: "Loan moved to pending review." });
      navigate(successRedirectPath);
    },
    onError: (error: Error) => {
      toast({ title: "Unable to create loan", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>

        {showChecklist ? (
          <Card>
            <CardHeader>
              <CardTitle>Product checklist</CardTitle>
              <CardDescription>Capture and confirm all required requirements before submit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.checklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Checkbox
                    checked={Boolean(uploadedDocMap[item])}
                    onCheckedChange={(checked) =>
                      setUploadedDocMap((prev) => ({ ...prev, [item]: Boolean(checked) }))
                    }
                  />
                  <Label className="font-normal">{item}</Label>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Create loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Borrower</Label>
                <Select value={borrowerId} onValueChange={setBorrowerId}>
                  <SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger>
                  <SelectContent>
                    {(borrowers || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {(b.full_name || b.email) + (b.nrc_number ? ` (${b.nrc_number})` : "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select value={employmentType} onValueChange={(v: "employed" | "self_employed" | "contract" | "other") => setEmploymentType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self_employed">Self-employed</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Loan amount (K)</Label>
                <Input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  Tenure ({termUnit})
                </Label>
                <Input type="number" value={termValue} onChange={(e) => setTermValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monthly income (K)</Label>
                <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Employer name</Label>
                <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
            </div>

            {productCode === "SALARY_ADVANCE" ? (
              <div className="flex items-center gap-3">
                <Checkbox checked={isCivilServantConfirmed} onCheckedChange={(v) => setIsCivilServantConfirmed(Boolean(v))} />
                <Label className="font-normal">Confirmed borrower is a civil servant</Label>
              </div>
            ) : null}

            {productCode === "MARKETEER" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business age (months)</Label>
                  <Input type="number" value={businessMonths} onChange={(e) => setBusinessMonths(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 mt-8">
                  <Checkbox
                    checked={hasLocalAuthorityCompliance}
                    onCheckedChange={(v) => setHasLocalAuthorityCompliance(Boolean(v))}
                  />
                  <Label className="font-normal">Local authority compliance confirmed</Label>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Admin notes</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>

            {preview ? (
              <Card className="bg-secondary/30">
                <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total repayment</p>
                    <p className="font-semibold">K{Number(preview.repayment).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{preview.installmentLabel}</p>
                    <p className="font-semibold">K{Number(preview.installment).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {validationErrors.length > 0 ? (
              <div className="space-y-2">
                {validationErrors.map((e) => (
                  <Badge key={e} variant="outline" className="mr-2 mb-2 border-destructive/40 text-destructive">
                    {e}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Loan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
