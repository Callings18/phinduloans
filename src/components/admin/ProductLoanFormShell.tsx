import { useMemo, useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateLoan } from "@/utils/loanCalculations";
import { useProductLoanRules } from "@/hooks/useProductLoanRules";
import type { LoanProductCode } from "@/config/loanProductModules";
import { calculateMarketeerLoan, getMarketeerTiersOrDefault, generateMarketeerCollectionDates } from "@/lib/marketeerCalculations";
import { BetaBadge } from "@/components/admin/BetaBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { AlertTriangle, CalendarDays, FileText, User, Briefcase, MapPin, CheckCircle2 } from "lucide-react";

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

  // --- Core fields ---
  const [borrowerId, setBorrowerId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [termValue, setTermValue] = useState(String(defaultTermValue));
  const [loanPurpose, setLoanPurpose] = useState("");
  const [employmentType, setEmploymentType] = useState<"employed" | "self_employed" | "contract" | "other">(
    productCode === "MARKETEER" ? "self_employed" : "employed"
  );
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [city, setCity] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // --- Marketeer-specific fields ---
  const [businessMonths, setBusinessMonths] = useState("0");
  const [isCivilServantConfirmed, setIsCivilServantConfirmed] = useState(false);
  const [hasLocalAuthorityCompliance, setHasLocalAuthorityCompliance] = useState(false);
  const [businessAddress, setBusinessAddress] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [idType, setIdType] = useState("NRC");
  const [idNumber, setIdNumber] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // --- Document checklist ---
  const [uploadedDocMap, setUploadedDocMap] = useState<Record<string, boolean>>({});
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);

  const { data: product } = useQuery({
    queryKey: ["product-by-code", productCode],
    queryFn: async () => {
      const fromAny = supabase.from as any;
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

  // Auto-fill from selected borrower
  useEffect(() => {
    if (selectedBorrower) {
      if (selectedBorrower.phone) setContactNumber(selectedBorrower.phone);
      if (selectedBorrower.nrc_number) setIdNumber(selectedBorrower.nrc_number);
      if (selectedBorrower.address) setResidentialAddress(selectedBorrower.address);
      if (selectedBorrower.city) setCity(selectedBorrower.city);
      if (selectedBorrower.employer_name) setEmployerName(selectedBorrower.employer_name);
      if (selectedBorrower.job_title) setJobTitle(selectedBorrower.job_title);
      if (selectedBorrower.net_income) setMonthlyIncome(String(selectedBorrower.net_income));
      if (selectedBorrower.employment_type) {
        setEmploymentType(selectedBorrower.employment_type as any);
      }
    }
  }, [selectedBorrower]);

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

  const isMarketeer = productCode === "MARKETEER";

  const marketeerResult = useMemo(() => {
    if (!isMarketeer || !product || !loanAmount) return null;
    const principal = Number(loanAmount || 0);
    if (principal <= 0) return null;
    const tiers = getMarketeerTiersOrDefault((product as any).pricing_tiers);
    return calculateMarketeerLoan(principal, tiers);
  }, [isMarketeer, product, loanAmount]);

  const collectionDates = useMemo(() => {
    if (!isMarketeer || !marketeerResult) return [];
    return generateMarketeerCollectionDates(new Date(), marketeerResult.durationDays);
  }, [isMarketeer, marketeerResult]);

  const preview = useMemo(() => {
    if (!product || !loanAmount || !termValue) return null;
    const principal = Number(loanAmount || 0);
    if (principal <= 0) return null;

    if (isMarketeer && marketeerResult) {
      return {
        repayment: marketeerResult.totalRepayment,
        interest: marketeerResult.totalInterest,
        installmentLabel: `Daily installment (${marketeerResult.durationDays} business days, Mon–Fri)`,
        installment: marketeerResult.dailyInstallment,
        dailyRate: `${(marketeerResult.tier.interestPercent / marketeerResult.durationDays).toFixed(3)}%`,
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
      interest: calc.totalInterest,
      installmentLabel: termUnit === "days" ? "Daily installment" : termUnit === "weeks" ? "Weekly installment" : "Monthly installment",
      installment: calc.dailyPayment || calc.weeklyPayment || calc.monthlyPayment,
      dailyRate: null,
    };
  }, [product, loanAmount, termValue, productCode, termUnit, isMarketeer, marketeerResult]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBorrower) throw new Error("Select a borrower first.");
      if (!product?.id) throw new Error("Loan product not found. Check product_code setup.");
      if (!user?.id) throw new Error("User session not found.");
      if (!loanAmount || !termValue || !loanPurpose || !monthlyIncome) {
        throw new Error("Fill in all required loan fields.");
      }
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);

      let totalRepayment = 0;
      let installmentAmount = 0;

      if (isMarketeer && marketeerResult) {
        totalRepayment = marketeerResult.totalRepayment;
        installmentAmount = marketeerResult.dailyInstallment;
      } else {
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
        totalRepayment = calc.totalRepayment;
        installmentAmount = calc.monthlyPayment;
      }

      const payload = {
        user_id: selectedBorrower.id,
        loan_product_id: product.id,
        full_name: selectedBorrower.full_name || selectedBorrower.email,
        email: selectedBorrower.email,
        phone: contactNumber || selectedBorrower.phone || "",
        nrc_number: idNumber || selectedBorrower.nrc_number || "",
        address: residentialAddress || selectedBorrower.address || null,
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
        monthly_payment: installmentAmount,
        total_repayment: totalRepayment,
        admin_notes: adminNotes || null,
        source: "internal",
        status: "pending" as const,
        product_specific_data: {
          product_code: productCode,
          business_months: Number(businessMonths || 0),
          civil_servant_confirmed: isCivilServantConfirmed,
          local_authority_compliance: hasLocalAuthorityCompliance,
          business_address: businessAddress,
          residential_address: residentialAddress,
          id_type: idType,
          id_number: idNumber,
          gender,
          marital_status: maritalStatus,
          contact_number: contactNumber,
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

  const allDocsChecked = rules.checklist.every((item) => uploadedDocMap[item]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{title}</h1>
              <BetaBadge />
            </div>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant="outline" className="text-sm">{productCode}</Badge>
        </div>

        {/* === SECTION 1: Customer Information === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Customer Information</CardTitle>
            </div>
            <CardDescription>Select an existing borrower or fill in customer details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Borrower *</Label>
                <Select value={borrowerId} onValueChange={setBorrowerId}>
                  <SelectTrigger><SelectValue placeholder="Search and select borrower..." /></SelectTrigger>
                  <SelectContent>
                    {(borrowers || []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {(b.full_name || b.email) + (b.nrc_number ? ` — ${b.nrc_number}` : "") + (b.phone ? ` — ${b.phone}` : "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBorrower && (
                <div className="md:col-span-2 bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Name:</span> <strong>{selectedBorrower.full_name}</strong></p>
                  <p><span className="text-muted-foreground">Phone:</span> {selectedBorrower.phone || "—"}</p>
                  <p><span className="text-muted-foreground">NRC:</span> {selectedBorrower.nrc_number || "—"}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Contact Number *</Label>
                <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="0971234567" />
              </div>
              <div className="space-y-2">
                <Label>ID Type</Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NRC">NRC</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="Driver License">Driver License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ID Number *</Label>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="123456/78/9" />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === SECTION 2: Address & Location === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Address & Location</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {isMarketeer && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Business Address *</Label>
                  <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Market stall location / stand number" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Residential Address</Label>
                <Input value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} placeholder="House number, area, compound" />
              </div>
              <div className="space-y-2">
                <Label>City / Town</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === SECTION 3: Employment / Business === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle>{isMarketeer ? "Business Information" : "Employment Details"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Employment Type *</Label>
                <Select value={employmentType} onValueChange={(v: any) => setEmploymentType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self_employed">Self-employed / Business Owner</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isMarketeer ? "Monthly Business Income (K)" : "Monthly Income (K)"} *</Label>
                <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
              </div>
              {!isMarketeer && (
                <>
                  <div className="space-y-2">
                    <Label>Employer Name</Label>
                    <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Title</Label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                  </div>
                </>
              )}
              {isMarketeer && (
                <div className="space-y-2">
                  <Label>Business Age (months) *</Label>
                  <Input type="number" value={businessMonths} onChange={(e) => setBusinessMonths(e.target.value)} min={0} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* === SECTION 4: Eligibility Checks (Marketeer) === */}
        {isMarketeer && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle>Eligibility Checks</CardTitle>
                <BetaBadge />
              </div>
              <CardDescription>All criteria must be met before the loan can proceed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={employmentType === "self_employed"}
                  onCheckedChange={() => setEmploymentType("self_employed")}
                />
                <Label className="font-normal">Borrower is a business owner</Label>
                {employmentType === "self_employed" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={hasLocalAuthorityCompliance}
                  onCheckedChange={(v) => setHasLocalAuthorityCompliance(Boolean(v))}
                />
                <Label className="font-normal">Complies with local authority requirements</Label>
                {hasLocalAuthorityCompliance && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={Number(businessMonths) >= 6}
                  disabled
                />
                <Label className="font-normal">Business exists for at least 6 months ({businessMonths} months entered)</Label>
                {Number(businessMonths) >= 6 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* === SECTION 5: Salary Advance civil servant check === */}
        {productCode === "SALARY_ADVANCE" && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Checkbox checked={isCivilServantConfirmed} onCheckedChange={(v) => setIsCivilServantConfirmed(Boolean(v))} />
                <Label className="font-normal">Confirmed borrower is a civil servant</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === SECTION 6: Loan Details === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Loan Details</CardTitle>
            </div>
            {isMarketeer && (
              <CardDescription>
                Interest: 30% flat · Duration: 26 business days (Mon–Fri) · Daily collection · Range: K1,000 – K10,000
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Loan Amount (K) *</Label>
                <Input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  min={isMarketeer ? 1000 : 0}
                  max={isMarketeer ? 10000 : undefined}
                  placeholder={isMarketeer ? "K1,000 – K10,000" : "Enter amount"}
                />
                {isMarketeer && loanAmount && (Number(loanAmount) < 1000 || Number(loanAmount) > 10000) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Marketeer loans must be between K1,000 and K10,000
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Tenure ({termUnit}) {isMarketeer && <span className="text-muted-foreground text-xs">(Fixed: 26 days)</span>}</Label>
                <Input
                  type="number"
                  value={termValue}
                  onChange={(e) => setTermValue(e.target.value)}
                  disabled={isMarketeer}
                />
              </div>
              <div className="space-y-2">
                <Label>Purpose *</Label>
                <Input
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder={isMarketeer ? "e.g. Stock purchase, working capital" : "Enter loan purpose"}
                />
              </div>
            </div>

            {/* Loan Preview */}
            {preview ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-bold text-lg">K{Number(loanAmount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Interest</p>
                      <p className="font-bold text-lg">K{Number(preview.interest).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Repayment</p>
                      <p className="font-bold text-lg text-primary">K{Number(preview.repayment).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{preview.installmentLabel}</p>
                      <p className="font-bold text-lg">K{Number(preview.installment).toLocaleString()}</p>
                    </div>
                  </div>
                  {preview.dailyRate && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Daily interest rate: {preview.dailyRate}/day
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Schedule Preview (Marketeer) */}
            {isMarketeer && collectionDates.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-2"
                  onClick={() => setShowSchedulePreview(!showSchedulePreview)}
                >
                  <CalendarDays className="h-4 w-4 mr-1" />
                  {showSchedulePreview ? "Hide" : "Preview"} Collection Schedule ({collectionDates.length} days)
                </Button>
                {showSchedulePreview && marketeerResult && (
                  <Card>
                    <CardContent className="pt-4 max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Day</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Day of Week</TableHead>
                            <TableHead className="text-right">Amount (K)</TableHead>
                            <TableHead className="text-right">Running Total (K)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collectionDates.map((date, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{i + 1}</TableCell>
                              <TableCell>{format(date, "dd MMM yyyy")}</TableCell>
                              <TableCell className="text-muted-foreground">{format(date, "EEEE")}</TableCell>
                              <TableCell className="text-right">K{marketeerResult.dailyInstallment.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-medium">
                                K{((i + 1) * marketeerResult.dailyInstallment).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === SECTION 7: Document Checklist === */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Required Documents</CardTitle>
              <BetaBadge />
            </div>
            <CardDescription>
              Check off each document as it's received. All items must be confirmed before submission.
            </CardDescription>
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
                {uploadedDocMap[item] && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            ))}
            {allDocsChecked && (
              <Badge variant="outline" className="border-green-600/40 text-green-600 mt-2">
                All documents confirmed ✓
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* === SECTION 8: Notes === */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes about this application..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* === Validation Errors === */}
        {validationErrors.length > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {validationErrors.map((e) => (
                    <p key={e} className="text-sm text-destructive">{e}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === Submit === */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            size="lg"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || validationErrors.length > 0}
          >
            {createMutation.isPending ? "Creating..." : "Create Loan Application"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
