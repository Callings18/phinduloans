import { useEffect, useMemo, useRef, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateLoan } from "@/utils/loanCalculations";
import { Loader2, AlertCircle, Info, Upload, X, Paperclip } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CollateralBorrowersSection, {
  type CollateralBorrowerEntry,
  makeBlankBorrower,
  validateCollateralBorrowers,
} from "@/components/loans/CollateralBorrowersSection";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

interface Props {
  loan: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

const EDITABLE_STATUSES = new Set(["pending", "under_review", "approved"]);

type ProductLock = {
  fixedAmount?: { min: number; max: number };
  fixedTerm?: { value: number; unit: string };
  note: string;
};

function getProductLock(productCode: string | null | undefined): ProductLock | null {
  switch ((productCode || "").toUpperCase()) {
    case "COLLATERAL":
      return {
        note: "Collateral loans allow 1-12 months. Use a term within this range.",
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

type LoanBorrowerRow = Database["public"]["Tables"]["loan_borrowers"]["Row"];

function rowToCollateralEntry(row: LoanBorrowerRow): CollateralBorrowerEntry {
  return {
    uid: row.id,
    customer_id: row.customer_id,
    full_name: row.full_name ?? "",
    nrc_number: row.nrc_number ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    role: row.role as CollateralBorrowerEntry["role"],
    is_signatory: row.is_signatory ?? true,
  };
}

type PendingUpload = { localId: string; file: File; label: string };

const EMPLOYMENT_TYPES: Database["public"]["Enums"]["employment_type"][] = [
  "employed",
  "self_employed",
  "contract",
  "other",
];

export default function EditPendingLoanDialog({ loan, open, onOpenChange, onSaved }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const editable = loan && EDITABLE_STATUSES.has(loan.status);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [purpose, setPurpose] = useState("");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralValue, setCollateralValue] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nrcNumber, setNrcNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] =
    useState<Database["public"]["Enums"]["employment_type"]>("employed");
  const [adminNotes, setAdminNotes] = useState("");
  const [docLabelPrefix, setDocLabelPrefix] = useState("Additional document");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const [primaryBorrowerEntry, setPrimaryBorrowerEntry] = useState<CollateralBorrowerEntry>(() =>
    makeBlankBorrower("PRIMARY_BORROWER"),
  );
  const [coBorrowerEntries, setCoBorrowerEntries] = useState<CollateralBorrowerEntry[]>([]);
  const [absoluteOwnerEntries, setAbsoluteOwnerEntries] = useState<CollateralBorrowerEntry[]>([]);

  const borrowersHydratedRef = useRef<string | null>(null);

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
      return data as Record<string, unknown> | null;
    },
  });

  const productCode = (product as { product_code?: string } | null)?.product_code ?? null;
  const isCollateralProduct = (productCode || "").toUpperCase() === "COLLATERAL";

  const { data: borrowerRows, isFetched: borrowersFetched } = useQuery({
    queryKey: ["edit-loan-borrowers", loan?.id],
    enabled: Boolean(open && loan?.id && isCollateralProduct),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_borrowers")
        .select("*")
        .eq("loan_application_id", loan!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lock = useMemo(() => getProductLock(productCode), [productCode]);
  const termLocked = !!lock?.fixedTerm;

  const collateralValidation = useMemo(
    () => validateCollateralBorrowers(primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries),
    [primaryBorrowerEntry, coBorrowerEntries, absoluteOwnerEntries],
  );

  useEffect(() => {
    if (!open || !loan) return;
    setAmount(String(loan.loan_amount ?? ""));
    setTermMonths(String(loan.loan_term_months ?? ""));
    setPurpose(loan.loan_purpose ?? "");
    setCollateralDescription(loan.collateral_description ?? "");
    setCollateralValue(loan.collateral_value ? String(loan.collateral_value) : "");
    setFullName(loan.full_name ?? "");
    setEmail(loan.email ?? "");
    setPhone(loan.phone ?? "");
    setNrcNumber(loan.nrc_number ?? "");
    setAddress(loan.address ?? "");
    setCity(loan.city ?? "");
    setMonthlyIncome(loan.monthly_income != null ? String(loan.monthly_income) : "");
    setEmployerName(loan.employer_name ?? "");
    setJobTitle(loan.job_title ?? "");
    setEmploymentType((loan.employment_type as Database["public"]["Enums"]["employment_type"]) || "employed");
    setAdminNotes(loan.admin_notes ?? "");
    setPendingUploads([]);
    borrowersHydratedRef.current = null;
  }, [open, loan]);

  useEffect(() => {
    if (lock?.fixedTerm) {
      setTermMonths(String(lock.fixedTerm.value));
    }
  }, [lock?.fixedTerm?.value, lock?.fixedTerm?.unit]);

  useEffect(() => {
    if (!open) {
      borrowersHydratedRef.current = null;
      return;
    }
    if (!loan?.id || !isCollateralProduct || !borrowersFetched) return;
    if (borrowersHydratedRef.current === loan.id) return;
    borrowersHydratedRef.current = loan.id;

    const rows = borrowerRows ?? [];
    if (rows.length === 0) {
      setPrimaryBorrowerEntry({
        ...makeBlankBorrower("PRIMARY_BORROWER"),
        customer_id: loan.user_id,
        full_name: loan.full_name ?? "",
        nrc_number: loan.nrc_number ?? "",
        phone: loan.phone ?? "",
        address: loan.address ?? "",
      });
      setCoBorrowerEntries([]);
      setAbsoluteOwnerEntries([]);
      return;
    }

    const primary = rows.find((r) => r.role === "PRIMARY_BORROWER");
    const co = rows.filter((r) => r.role === "CO_BORROWER");
    const owners = rows.filter((r) => r.role === "ABSOLUTE_OWNER");

    if (primary) {
      setPrimaryBorrowerEntry({
        ...rowToCollateralEntry(primary),
        customer_id: primary.customer_id || loan.user_id,
      });
    } else {
      setPrimaryBorrowerEntry({
        ...makeBlankBorrower("PRIMARY_BORROWER"),
        customer_id: loan.user_id,
        full_name: loan.full_name ?? "",
        nrc_number: loan.nrc_number ?? "",
        phone: loan.phone ?? "",
        address: loan.address ?? "",
      });
    }
    setCoBorrowerEntries(co.map((r) => rowToCollateralEntry(r)));
    setAbsoluteOwnerEntries(owners.map((r) => rowToCollateralEntry(r)));
  }, [open, loan, isCollateralProduct, borrowersFetched, borrowerRows]);

  const appendPendingFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const prefix = docLabelPrefix.trim() || "Document";
    const next: PendingUpload[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file) continue;
      const localId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${i}-${Math.random()}`;
      next.push({
        localId,
        file,
        label: `${prefix} — ${file.name}`,
      });
    }
    setPendingUploads((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("No loan");
      if (!editable) throw new Error("Loan can no longer be edited at this stage");
      const amt = Number(amount);
      const term = Number(termMonths);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
      if (!Number.isFinite(term) || term <= 0) throw new Error("Enter a valid term");

      if (lock?.fixedAmount) {
        const { min, max } = lock.fixedAmount;
        if (amt < min || amt > max) {
          throw new Error(`Amount must be between K${min.toLocaleString()} and K${max.toLocaleString()}`);
        }
      }
      if (isCollateralProduct && (term < 1 || term > 12)) {
        throw new Error("Collateral loan term must be between 1 and 12 months.");
      }
      if (lock?.fixedTerm && term !== lock.fixedTerm.value) {
        throw new Error(`Term is fixed at ${lock.fixedTerm.value} ${lock.fixedTerm.unit} for this product`);
      }

      if (isCollateralProduct && !collateralValidation.isValid) {
        throw new Error(collateralValidation.errors[0] || "Borrowers section incomplete.");
      }

      if (!fullName.trim()) throw new Error("Full name is required.");
      if (!email.trim()) throw new Error("Email is required.");
      if (!phone.trim()) throw new Error("Phone is required.");
      if (!nrcNumber.trim()) throw new Error("NRC is required.");

      const incomeNum = Number(monthlyIncome);
      if (!Number.isFinite(incomeNum) || incomeNum < 0) throw new Error("Enter a valid monthly income");

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
          /* totals unchanged */
        }
      }

      const update: Record<string, unknown> = {
        loan_amount: amt,
        loan_term_months: term,
        loan_purpose: purpose || null,
        collateral_description: collateralDescription || null,
        collateral_value: collateralValue ? Number(collateralValue) : null,
        full_name: fullName.trim() || null,
        email: email.trim(),
        phone: phone.trim(),
        nrc_number: nrcNumber.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        monthly_income: incomeNum,
        employer_name: employerName.trim() || null,
        job_title: jobTitle.trim() || null,
        employment_type: employmentType,
        admin_notes: adminNotes.trim() || null,
      };
      if (totals) {
        update.total_repayment = totals.totalRepayment;
        update.monthly_payment = totals.monthlyPayment;
      }

      const { error: loanErr } = await supabase.from("loan_applications").update(update).eq("id", loan.id);
      if (loanErr) throw loanErr;

      if (isCollateralProduct && user?.id) {
        const { error: delErr } = await supabase
          .from("loan_borrowers")
          .delete()
          .eq("loan_application_id", loan.id);
        if (delErr) throw delErr;

        const primaryRow = {
          ...primaryBorrowerEntry,
          customer_id: loan.user_id,
          role: "PRIMARY_BORROWER" as const,
        };

        const rows = [
          {
            loan_application_id: loan.id,
            customer_id: primaryRow.customer_id,
            full_name: primaryRow.full_name,
            nrc_number: primaryRow.nrc_number,
            phone: primaryRow.phone || null,
            address: primaryRow.address || null,
            role: "PRIMARY_BORROWER" as const,
            is_signatory: primaryRow.is_signatory,
            created_by: user.id,
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
            created_by: user.id,
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
            created_by: user.id,
          })),
        ];

        const { error: insErr } = await supabase.from("loan_borrowers").insert(rows);
        if (insErr) throw insErr;
      }

      const borrowerId = loan.user_id as string | undefined;
      if (pendingUploads.length > 0 && !borrowerId) {
        throw new Error("This loan has no linked borrower; cannot upload documents.");
      }
      for (let i = 0; i < pendingUploads.length; i++) {
        const item = pendingUploads[i];
        const ext = item.file.name.split(".").pop() || "bin";
        const slug =
          `admin_edit_${Date.now()}_${i}_` +
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID().slice(0, 8)
            : `${Math.random().toString(36).slice(2, 10)}`);
        const path = `loan-docs/${borrowerId!}/${loan.id}/${slug}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("loan-documents")
          .upload(path, item.file, { upsert: false });
        if (upErr) throw upErr;

        await supabase
          .from("borrower_document_vault")
          .insert({
            borrower_id: borrowerId,
            doc_type: slug,
            doc_label: item.label.trim() || item.file.name,
            file_url: path,
            file_name: item.file.name,
            mime_type: item.file.type || null,
            file_size: item.file.size,
          })
          .then(({ error }) => {
            if (error) console.warn("Vault insert (edit loan):", error);
          });

        const { error: docErr } = await supabase.from("application_documents").insert({
          application_id: loan.id,
          borrower_id: borrowerId,
          doc_type: slug,
          doc_label: item.label.trim() || item.file.name,
          file_url: path,
          file_name: item.file.name,
          mime_type: item.file.type || null,
          file_size: item.file.size,
          loan_product_id: loan.loan_product_id ?? null,
          uploaded_by: user?.id ?? null,
        });
        if (docErr) throw docErr;
      }
    },
    onSuccess: () => {
      toast.success("Loan updated");
      qc.invalidateQueries({ queryKey: ["admin-active-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-all-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["house-loans"] });
      qc.invalidateQueries({ queryKey: ["application-documents", loan?.id] });
      qc.invalidateQueries({ queryKey: ["application-documents-verify", loan?.id] });
      qc.invalidateQueries({ queryKey: ["edit-loan-borrowers", loan?.id] });
      qc.invalidateQueries({ queryKey: ["borrower-kyc-vault", loan?.user_id] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-2 space-y-1 shrink-0">
          <DialogTitle>Edit loan application</DialogTitle>
          <DialogDescription className="text-sm">
            Update applicant details, collateral parties, documents, and loan terms. Totals recalculate when amount or
            term change.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-7.5rem)] px-6">
          <div className="space-y-4 pb-4 pr-3">
            {!editable && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This loan is at status <strong>{loan?.status}</strong> and can no longer be edited here. Use
                  Restructure or Top-Up instead.
                </AlertDescription>
              </Alert>
            )}

            {lock && editable && (
              <Alert className="py-2">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">{lock.note}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applicant</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-full-name">Full name</Label>
                  <Input
                    id="edit-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editable} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-nrc">NRC</Label>
                  <Input id="edit-nrc" value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value)} disabled={!editable} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!editable} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-city">City</Label>
                  <Input id="edit-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!editable} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-income">Monthly income (K)</Label>
                  <Input
                    id="edit-income"
                    type="number"
                    min={0}
                    step="0.01"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-employer">Employer</Label>
                  <Input
                    id="edit-employer"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-job">Job title</Label>
                  <Input id="edit-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={!editable} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Employment type</Label>
                  <Select
                    value={employmentType}
                    onValueChange={(v) => setEmploymentType(v as Database["public"]["Enums"]["employment_type"])}
                    disabled={!editable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
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
                <div className="space-y-1">
                  <Label htmlFor="edit-term">
                    Term ({lock?.fixedTerm?.unit || (product as any)?.term_unit || loan?.term_unit || "months"})
                    {termLocked && <span className="ml-1 text-xs text-muted-foreground">(fixed)</span>}
                    {isCollateralProduct && !termLocked && (
                      <span className="ml-1 text-xs text-muted-foreground">(1-12 months)</span>
                    )}
                  </Label>
                  <Input
                    id="edit-term"
                    type="number"
                    min={1}
                    max={isCollateralProduct ? 12 : undefined}
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    disabled={!editable || termLocked || productLoading}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-purpose">Loan purpose</Label>
                <Textarea
                  id="edit-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  disabled={!editable}
                  className="min-h-[72px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-coll-desc">Collateral description</Label>
                  <Input
                    id="edit-coll-desc"
                    value={collateralDescription}
                    onChange={(e) => setCollateralDescription(e.target.value)}
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1">
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
            </div>

            {isCollateralProduct && editable && (
              <CollateralBorrowersSection
                primary={primaryBorrowerEntry}
                coBorrowers={coBorrowerEntries}
                absoluteOwners={absoluteOwnerEntries}
                onPrimaryChange={setPrimaryBorrowerEntry}
                onCoBorrowersChange={setCoBorrowerEntries}
                onAbsoluteOwnersChange={setAbsoluteOwnerEntries}
                primaryLocked={false}
              />
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</h4>
              <div className="space-y-1">
                <Label htmlFor="edit-admin-notes">Internal notes</Label>
                <Textarea
                  id="edit-admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  disabled={!editable}
                  className="min-h-[64px]"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <h4 className="text-xs font-semibold uppercase tracking-wide">Add documents (any number)</h4>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Files upload to this loan and the borrower vault. Use a clear label so they appear correctly on the loan
                documents view.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-doc-label">Label for new files</Label>
                  <Input
                    id="edit-doc-label"
                    value={docLabelPrefix}
                    onChange={(e) => setDocLabelPrefix(e.target.value)}
                    placeholder="e.g. Collateral angle 2"
                    disabled={!editable}
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    disabled={!editable}
                    onChange={(e) => appendPendingFiles(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={!editable}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Choose files
                  </Button>
                </div>
              </div>
              {pendingUploads.length > 0 && (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {pendingUploads.map((p) => (
                    <li
                      key={p.localId}
                      className="flex items-start gap-2 text-xs rounded border border-border/50 bg-background/80 p-2"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input
                          value={p.label}
                          onChange={(e) =>
                            setPendingUploads((list) =>
                              list.map((x) => (x.localId === p.localId ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          disabled={!editable}
                          className="h-8 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground truncate">{p.file.name}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={!editable}
                        onClick={() => setPendingUploads((list) => list.filter((x) => x.localId !== p.localId))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/60 shrink-0 gap-2 sm:gap-0">
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
