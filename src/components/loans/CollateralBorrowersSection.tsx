import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Users, UserPlus, ShieldCheck, Trash2, AlertCircle, Info, Search, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Lightweight directory entry exposed to this section so admins can pick
// existing borrowers (profiles) instead of typing details every time.
export interface BorrowerDirectoryEntry {
  id: string;
  full_name: string | null;
  nrc_number: string | null;
  phone: string | null;
  address: string | null;
  email?: string | null;
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
  // optional directory of existing borrowers — enables "pick from database" UX
  borrowerDirectory?: BorrowerDirectoryEntry[];
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
  // NRCs intentionally shared across roles (e.g. co-borrower + absolute owner = same person).
  // These are EXPECTED for collateral loans (couple jointly on title deed) and shouldn't be
  // surfaced as a warning, only as an informational badge.
  expectedSharedNrcs: Set<string>;
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

  // Classify NRCs that appear more than once. Sharing an NRC across CO_BORROWER and
  // ABSOLUTE_OWNER is a legitimate collateral pattern (e.g. spouse jointly on title deed).
  // Same NRC duplicated within the SAME role is still suspicious and surfaces as a warning.
  const occurrences = new Map<string, { coBorrower: number; absoluteOwner: number; primary: number }>();
  const note = (nrc: string, kind: "coBorrower" | "absoluteOwner" | "primary") => {
    if (!nrc || !NRC_REGEX.test(nrc)) return;
    const cur = occurrences.get(nrc) || { coBorrower: 0, absoluteOwner: 0, primary: 0 };
    cur[kind] += 1;
    occurrences.set(nrc, cur);
  };
  note(primary.nrc_number.trim(), "primary");
  coBorrowers.forEach((b) => note(b.nrc_number.trim(), "coBorrower"));
  absoluteOwners.forEach((b) => note(b.nrc_number.trim(), "absoluteOwner"));

  const duplicateNrcs = new Set<string>();
  const expectedSharedNrcs = new Set<string>();
  for (const [nrc, c] of occurrences.entries()) {
    const total = c.coBorrower + c.absoluteOwner + c.primary;
    if (total <= 1) continue;
    const sameRoleDup =
      c.coBorrower > 1 || c.absoluteOwner > 1 || c.primary > 1;
    if (sameRoleDup) {
      duplicateNrcs.add(nrc);
      warnings.push(`NRC ${nrc} appears more than once within the same role.`);
    } else {
      // Cross-role share — expected for collateral (e.g. couple jointly on title deed).
      expectedSharedNrcs.add(nrc);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings,
    signatoryCount,
    rowErrors,
    duplicateNrcs,
    expectedSharedNrcs,
  };
};

// Inline search-as-you-type picker that lets admins pull a row from the existing
// borrower directory. Selecting fills name / NRC / phone / address in one click.
const BorrowerPicker = ({
  options,
  onPick,
  selectedNrc,
}: {
  options: BorrowerDirectoryEntry[];
  onPick: (b: BorrowerDirectoryEntry) => void;
  selectedNrc?: string;
}) => {
  const [open, setOpen] = useState(false);
  const matched = useMemo(
    () => options.find((o) => (o.nrc_number || "").trim() === (selectedNrc || "").trim()),
    [options, selectedNrc],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          size="sm"
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {matched
              ? `${matched.full_name || "Unnamed"} · ${matched.nrc_number || "—"}`
              : "Pick from existing borrowers…"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command
          filter={(value, search) => {
            // value is composed below as `${name}|${nrc}|${phone}` in lowercase
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search by name, NRC, or phone…" />
          <CommandList>
            <CommandEmpty>No matching borrower.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const valueKey = `${opt.full_name || ""}|${opt.nrc_number || ""}|${opt.phone || ""}|${opt.email || ""}`.toLowerCase();
                return (
                  <CommandItem
                    key={opt.id}
                    value={valueKey}
                    onSelect={() => {
                      onPick(opt);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5",
                          matched?.id === opt.id ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <span className="font-medium text-sm">{opt.full_name || opt.email || "Unnamed"}</span>
                    </div>
                    <div className="ml-5 text-[11px] text-muted-foreground">
                      {opt.nrc_number || "no NRC"} · {opt.phone || "no phone"}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const Row = ({
  entry,
  onChange,
  onRemove,
  roleLocked,
  index,
  fieldErrors,
  isDuplicateNrc,
  isExpectedShared,
  readOnlyFields,
  borrowerDirectory,
}: {
  entry: CollateralBorrowerEntry;
  onChange: (next: CollateralBorrowerEntry) => void;
  onRemove?: () => void;
  roleLocked?: boolean;
  index?: number;
  fieldErrors?: RowFieldErrors;
  isDuplicateNrc?: boolean;
  isExpectedShared?: boolean;
  readOnlyFields?: boolean;
  borrowerDirectory?: BorrowerDirectoryEntry[];
}) => {
  const update = <K extends keyof CollateralBorrowerEntry>(k: K, v: CollateralBorrowerEntry[K]) =>
    onChange({ ...entry, [k]: v });

  const hasError = !!fieldErrors && Object.keys(fieldErrors).length > 0;
  const containerCls = hasError
    ? "rounded-lg border border-destructive/60 bg-destructive/5 p-3 space-y-2.5 ring-1 ring-destructive/30"
    : "rounded-lg border border-border/60 bg-card/40 p-3 space-y-2.5";

  const fieldErrCls = (msg?: string) =>
    msg ? "border-destructive focus-visible:ring-destructive" : "";

  const handlePick = (b: BorrowerDirectoryEntry) => {
    onChange({
      ...entry,
      customer_id: b.id,
      full_name: b.full_name || "",
      nrc_number: b.nrc_number || "",
      phone: b.phone || "",
      address: b.address || "",
    });
  };

  return (
    <div className={containerCls}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={entry.role === "PRIMARY_BORROWER" ? "default" : "secondary"}>
            {entry.role === "PRIMARY_BORROWER"
              ? "Primary Borrower"
              : entry.role === "CO_BORROWER"
              ? `Co-Borrower${index !== undefined ? ` #${index + 1}` : ""}`
              : `Absolute Owner${index !== undefined ? ` #${index + 1}` : ""}`}
          </Badge>
          {entry.is_signatory && (
            <Badge variant="outline" className="text-[10px] py-0 h-5">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Signatory
            </Badge>
          )}
          {entry.customer_id && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              From directory
            </Badge>
          )}
          {hasError && (
            <Badge variant="destructive" className="text-[10px] py-0 h-5">
              <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Needs attention
            </Badge>
          )}
          {isDuplicateNrc && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 border-warning text-warning">
              Same role NRC
            </Badge>
          )}
          {isExpectedShared && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 border-primary/50 text-primary">
              Same person multi-role
            </Badge>
          )}
        </div>
        {onRemove && !roleLocked && (
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {!readOnlyFields && borrowerDirectory && borrowerDirectory.length > 0 && !roleLocked && (
        <BorrowerPicker
          options={borrowerDirectory}
          onPick={handlePick}
          selectedNrc={entry.nrc_number}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="text-xs">Full Name *</Label>
          <Input
            value={entry.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            placeholder="As per NRC"
            className={cn("h-9", fieldErrCls(fieldErrors?.full_name))}
            aria-invalid={!!fieldErrors?.full_name}
            readOnly={readOnlyFields}
          />
          {fieldErrors?.full_name && (
            <p className="text-[10px] text-destructive">{fieldErrors.full_name}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">NRC Number *</Label>
          <Input
            value={entry.nrc_number}
            onChange={(e) => update("nrc_number", e.target.value)}
            placeholder="000000/00/0"
            className={cn("h-9", fieldErrCls(fieldErrors?.nrc_number))}
            aria-invalid={!!fieldErrors?.nrc_number}
            readOnly={readOnlyFields}
          />
          {fieldErrors?.nrc_number && (
            <p className="text-[10px] text-destructive">{fieldErrors.nrc_number}</p>
          )}
          {!fieldErrors?.nrc_number && isDuplicateNrc && (
            <p className="text-[10px] text-warning">Same NRC already used in this role.</p>
          )}
          {!fieldErrors?.nrc_number && !isDuplicateNrc && isExpectedShared && (
            <p className="text-[10px] text-primary">Same person also recorded in another role — allowed.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input
            className="h-9"
            value={entry.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+260…"
            readOnly={readOnlyFields}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Address</Label>
          <Input
            className="h-9"
            value={entry.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="Physical address"
            readOnly={readOnlyFields}
          />
        </div>
      </div>
      {fieldErrors?.role && (
        <p className="text-[10px] text-destructive">{fieldErrors.role}</p>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`sig-${entry.uid}`}
          checked={entry.is_signatory}
          onCheckedChange={(v) => update("is_signatory", !!v)}
        />
        <Label htmlFor={`sig-${entry.uid}`} className="cursor-pointer text-xs">
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
  borrowerDirectory,
}: Props) {
  const validation = useMemo(
    () => validateCollateralBorrowers(primary, coBorrowers, absoluteOwners),
    [primary, coBorrowers, absoluteOwners],
  );

  // Hide the primary borrower from the directory pickers — they're already the primary.
  const directoryForExtras = useMemo(() => {
    if (!borrowerDirectory) return undefined;
    const primaryId = primary.customer_id;
    return borrowerDirectory.filter((b) => b.id !== primaryId);
  }, [borrowerDirectory, primary.customer_id]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Users size={16} className="text-primary" />
          Borrowers & Collateral Owners
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <Alert className="border-primary/30 bg-primary/5 py-2">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs leading-relaxed">
            Add Co-Borrowers (jointly liable) and Absolute Owners (legal owners of the pledged collateral).
            All signatories must sign the contract. Borrowers are <strong>jointly and severally liable</strong>.
            <span className="block mt-1 text-muted-foreground">
              The same person can appear as both Co-Borrower and Absolute Owner (e.g., a couple jointly on the title deed)
              — that is expected and the application will still go through.
            </span>
          </AlertDescription>
        </Alert>

        {/* Primary */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide text-muted-foreground">
            Primary Borrower
          </h4>
          {primaryLocked ? (
            (() => {
              const errs = validation.rowErrors[primary.uid];
              const dup = validation.duplicateNrcs.has(primary.nrc_number.trim());
              const shared = validation.expectedSharedNrcs.has(primary.nrc_number.trim());
              const hasErr = !!errs && Object.keys(errs).length > 0;
              return (
                <div
                  className={
                    hasErr
                      ? "rounded-lg border border-destructive/60 bg-destructive/5 p-3 space-y-1.5 ring-1 ring-destructive/30"
                      : "rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5"
                  }
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge>Primary Borrower</Badge>
                    <Badge variant="outline" className="text-[10px] py-0 h-5">
                      <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Signatory
                    </Badge>
                    {hasErr && (
                      <Badge variant="destructive" className="text-[10px] py-0 h-5">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Needs attention
                      </Badge>
                    )}
                    {dup && (
                      <Badge variant="outline" className="text-[10px] py-0 h-5 border-warning text-warning">
                        Duplicate NRC
                      </Badge>
                    )}
                    {shared && (
                      <Badge variant="outline" className="text-[10px] py-0 h-5 border-primary/50 text-primary">
                        Same person multi-role
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs leading-snug">
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
                  {hasErr && (
                    <ul className="text-[10px] text-destructive list-disc pl-4">
                      {Object.values(errs!).filter(Boolean).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()
          ) : (
            <Row
              entry={primary}
              onChange={onPrimaryChange}
              roleLocked
              fieldErrors={validation.rowErrors[primary.uid]}
              isDuplicateNrc={validation.duplicateNrcs.has(primary.nrc_number.trim())}
              isExpectedShared={validation.expectedSharedNrcs.has(primary.nrc_number.trim())}
            />
          )}
        </div>

        {/* Co-Borrowers */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide text-muted-foreground">
              Co-Borrowers ({coBorrowers.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onCoBorrowersChange([...coBorrowers, makeBlankBorrower("CO_BORROWER")])}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Co-Borrower
            </Button>
          </div>
          {coBorrowers.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No Co-Borrowers added. Optional.</p>
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
              fieldErrors={validation.rowErrors[cb.uid]}
              isDuplicateNrc={validation.duplicateNrcs.has(cb.nrc_number.trim())}
              isExpectedShared={validation.expectedSharedNrcs.has(cb.nrc_number.trim())}
              borrowerDirectory={directoryForExtras}
            />
          ))}
        </div>

        {/* Absolute Owners */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide text-muted-foreground">
              Absolute Owners ({absoluteOwners.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onAbsoluteOwnersChange([...absoluteOwners, makeBlankBorrower("ABSOLUTE_OWNER")])}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Absolute Owner
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Required when the legal owner of the collateral is different from (or the same as) the borrower.
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
              fieldErrors={validation.rowErrors[ao.uid]}
              isDuplicateNrc={validation.duplicateNrcs.has(ao.nrc_number.trim())}
              isExpectedShared={validation.expectedSharedNrcs.has(ao.nrc_number.trim())}
              borrowerDirectory={directoryForExtras}
            />
          ))}
        </div>

        {/* Summary / validation */}
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs grid grid-cols-2 gap-3">
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
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <ul className="list-disc pl-4 space-y-0.5">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert className="border-warning/40 bg-warning/10 py-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">
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
