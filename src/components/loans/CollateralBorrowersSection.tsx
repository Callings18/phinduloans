import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, UserPlus, ShieldCheck, Trash2, AlertCircle, Info } from "lucide-react";

export type CollateralBorrowerRole = "PRIMARY_BORROWER" | "CO_BORROWER" | "ABSOLUTE_OWNER";

export interface CollateralBorrowerEntry {
  // local-only id used for React keys
  uid: string;
  customer_id?: string | null;
  full_name: string;
  nrc_number: string;
  phone: string;
  address: string;
  role: CollateralBorrowerRole;
  is_signatory: boolean;
}

interface Props {
  primary: CollateralBorrowerEntry; // always rendered, locked role
  coBorrowers: CollateralBorrowerEntry[];
  absoluteOwners: CollateralBorrowerEntry[];
  onPrimaryChange: (next: CollateralBorrowerEntry) => void;
  onCoBorrowersChange: (next: CollateralBorrowerEntry[]) => void;
  onAbsoluteOwnersChange: (next: CollateralBorrowerEntry[]) => void;
  // when true, primary fields are read-only (e.g., borrower-side using their own profile)
  primaryLocked?: boolean;
}

const NRC_REGEX = /^\d{6}\/\d{2}\/\d$/;
const newUid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const makeBlankBorrower = (role: CollateralBorrowerRole): CollateralBorrowerEntry => ({
  uid: newUid(),
  full_name: "",
  nrc_number: "",
  phone: "",
  address: "",
  role,
  is_signatory: true,
});

export interface RowFieldErrors {
  full_name?: string;
  nrc_number?: string;
  role?: string;
}

export interface CollateralBorrowersValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  signatoryCount: number;
  rowErrors: Record<string, RowFieldErrors>; // keyed by entry.uid
  duplicateNrcs: Set<string>;
}

const ALLOWED_ROLES: CollateralBorrowerRole[] = ["PRIMARY_BORROWER", "CO_BORROWER", "ABSOLUTE_OWNER"];

const validateRow = (b: CollateralBorrowerEntry, label: string): RowFieldErrors => {
  const errs: RowFieldErrors = {};
  if (!b.full_name.trim()) errs.full_name = `${label}: full name is required.`;
  if (!b.nrc_number.trim()) errs.nrc_number = `${label}: NRC is required.`;
  else if (!NRC_REGEX.test(b.nrc_number.trim()))
    errs.nrc_number = `${label}: NRC must be in the format 000000/00/0.`;
  if (!ALLOWED_ROLES.includes(b.role)) errs.role = `${label}: invalid role.`;
  return errs;
};

export const validateCollateralBorrowers = (
  primary: CollateralBorrowerEntry,
  coBorrowers: CollateralBorrowerEntry[],
  absoluteOwners: CollateralBorrowerEntry[],
): CollateralBorrowersValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rowErrors: Record<string, RowFieldErrors> = {};

  const primaryErrs = validateRow(primary, "Primary Borrower");
  if (Object.keys(primaryErrs).length) {
    rowErrors[primary.uid] = primaryErrs;
    Object.values(primaryErrs).forEach((m) => m && errors.push(m));
  }
  if (primary.role !== "PRIMARY_BORROWER") {
    rowErrors[primary.uid] = { ...(rowErrors[primary.uid] || {}), role: "Primary Borrower role mismatch." };
    errors.push("Primary Borrower role mismatch.");
  }

  coBorrowers.forEach((b, i) => {
    const label = `Co-Borrower #${i + 1}`;
    const errs = validateRow(b, label);
    if (b.role !== "CO_BORROWER") errs.role = `${label}: must have role Co-Borrower.`;
    if (Object.keys(errs).length) {
      rowErrors[b.uid] = errs;
      Object.values(errs).forEach((m) => m && errors.push(m));
    }
  });

  absoluteOwners.forEach((b, i) => {
    const label = `Absolute Owner #${i + 1}`;
    const errs = validateRow(b, label);
    if (b.role !== "ABSOLUTE_OWNER") errs.role = `${label}: must have role Absolute Owner.`;
    if (Object.keys(errs).length) {
      rowErrors[b.uid] = errs;
      Object.values(errs).forEach((m) => m && errors.push(m));
    }
  });

  const signatoryCount =
    (primary.is_signatory ? 1 : 0) +
    coBorrowers.filter((b) => b.is_signatory).length +
    absoluteOwners.filter((b) => b.is_signatory).length;
  if (signatoryCount < 1) errors.push("At least one signatory is required.");

  // Duplicate NRC detection (warning + per-row highlight)
  const nrcCounts = new Map<string, number>();
  [primary, ...coBorrowers, ...absoluteOwners].forEach((b) => {
    const key = b.nrc_number.trim();
    if (!key || !NRC_REGEX.test(key)) return;
    nrcCounts.set(key, (nrcCounts.get(key) || 0) + 1);
  });
  const duplicateNrcs = new Set<string>();
  for (const [nrc, count] of nrcCounts.entries()) {
    if (count > 1) {
      duplicateNrcs.add(nrc);
      warnings.push(`The NRC ${nrc} appears more than once across roles.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings,
    signatoryCount,
    rowErrors,
    duplicateNrcs,
  };
};

const Row = ({
  entry,
  onChange,
  onRemove,
  roleLocked,
  index,
}: {
  entry: CollateralBorrowerEntry;
  onChange: (next: CollateralBorrowerEntry) => void;
  onRemove?: () => void;
  roleLocked?: boolean;
  index?: number;
}) => {
  const update = <K extends keyof CollateralBorrowerEntry>(k: K, v: CollateralBorrowerEntry[K]) =>
    onChange({ ...entry, [k]: v });

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={entry.role === "PRIMARY_BORROWER" ? "default" : "secondary"}>
            {entry.role === "PRIMARY_BORROWER"
              ? "Primary Borrower"
              : entry.role === "CO_BORROWER"
              ? `Co-Borrower${index !== undefined ? ` #${index + 1}` : ""}`
              : `Absolute Owner${index !== undefined ? ` #${index + 1}` : ""}`}
          </Badge>
          {entry.is_signatory && (
            <Badge variant="outline" className="text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" /> Signatory
            </Badge>
          )}
        </div>
        {onRemove && !roleLocked && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Full Name *</Label>
          <Input
            value={entry.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder="As per NRC"
          />
        </div>
        <div>
          <Label>NRC Number *</Label>
          <Input
            value={entry.nrc_number}
            onChange={(e) => update("nrc_number", e.target.value)}
            placeholder="000000/00/0"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={entry.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+260..." />
        </div>
        <div>
          <Label>Address</Label>
          <Input value={entry.address} onChange={(e) => update("address", e.target.value)} placeholder="Physical address" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`sig-${entry.uid}`}
          checked={entry.is_signatory}
          onCheckedChange={(v) => update("is_signatory", !!v)}
        />
        <Label htmlFor={`sig-${entry.uid}`} className="cursor-pointer text-sm">
          Signatory required (will sign the contract)
        </Label>
      </div>
    </div>
  );
};

export default function CollateralBorrowersSection({
  primary,
  coBorrowers,
  absoluteOwners,
  onPrimaryChange,
  onCoBorrowersChange,
  onAbsoluteOwnersChange,
  primaryLocked,
}: Props) {
  const validation = useMemo(
    () => validateCollateralBorrowers(primary, coBorrowers, absoluteOwners),
    [primary, coBorrowers, absoluteOwners],
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users size={16} className="text-primary" />
          Borrowers & Collateral Owners
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            Collateral loans support multiple parties. Add Co-Borrowers (jointly liable) and Absolute Owners (legal owners
            of the pledged collateral). All signatories must sign the contract. All borrowers are <strong>jointly and
            severally liable</strong>.
          </AlertDescription>
        </Alert>

        {/* Primary */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Primary Borrower</h4>
          {primaryLocked ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge>Primary Borrower</Badge>
                <Badge variant="outline" className="text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Signatory
                </Badge>
              </div>
              <div className="text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {primary.full_name || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">NRC:</span> {primary.nrc_number || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> {primary.phone || "—"}
                </div>
              </div>
            </div>
          ) : (
            <Row entry={primary} onChange={onPrimaryChange} roleLocked />
          )}
        </div>

        {/* Co-Borrowers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Co-Borrowers ({coBorrowers.length})</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCoBorrowersChange([...coBorrowers, makeBlankBorrower("CO_BORROWER")])}
            >
              <UserPlus className="w-4 h-4 mr-1" /> Add Co-Borrower
            </Button>
          </div>
          {coBorrowers.length === 0 && (
            <p className="text-xs text-muted-foreground">No Co-Borrowers added. Optional.</p>
          )}
          {coBorrowers.map((cb, i) => (
            <Row
              key={cb.uid}
              entry={cb}
              index={i}
              onChange={(next) => {
                const copy = [...coBorrowers];
                copy[i] = next;
                onCoBorrowersChange(copy);
              }}
              onRemove={() => onCoBorrowersChange(coBorrowers.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        {/* Absolute Owners */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Absolute Owners ({absoluteOwners.length})</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAbsoluteOwnersChange([...absoluteOwners, makeBlankBorrower("ABSOLUTE_OWNER")])}
            >
              <UserPlus className="w-4 h-4 mr-1" /> Add Absolute Owner
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Required when the legal owner of the collateral is different from (or in addition to) the borrower.
          </p>
          {absoluteOwners.map((ao, i) => (
            <Row
              key={ao.uid}
              entry={ao}
              index={i}
              onChange={(next) => {
                const copy = [...absoluteOwners];
                copy[i] = next;
                onAbsoluteOwnersChange(copy);
              }}
              onRemove={() => onAbsoluteOwnersChange(absoluteOwners.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        {/* Summary / validation */}
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total parties</span>
            <span className="font-semibold">{1 + coBorrowers.length + absoluteOwners.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Signatories</span>
            <span className="font-semibold">{validation.signatoryCount}</span>
          </div>
        </div>

        {validation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert className="border-warning/40 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
