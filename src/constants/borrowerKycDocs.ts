/**
 * Canonical borrower vault identity docs (borrower_document_vault.doc_type).
 * Use everywhere we check "core KYC" so application flow aliases stay compatible.
 */
export const BORROWER_VAULT_KYC_DOC_TYPES = [
  { type: "nrc_front", label: "NRC (Front)", accept: "image/*", capture: true as const },
  { type: "nrc_back", label: "NRC (Back)", accept: "image/*", capture: true as const },
  { type: "selfie", label: "Selfie Holding NRC", accept: "image/*", capture: true as const },
] as const;

/** Vault keys that satisfy the "selfie" requirement (legacy + application naming). */
export const BORROWER_SELFIE_VAULT_ALIASES = ["selfie", "selfie_holding_nrc"] as const;

/** Identity keys referenced during loan application document step (product + vault). */
export const LOAN_APPLICATION_IDENTITY_DOC_TYPES = [
  "nrc_front",
  "nrc_back",
  "selfie_holding_nrc",
  "selfie",
] as const;

export type BorrowerVaultKycDocType = (typeof BORROWER_VAULT_KYC_DOC_TYPES)[number]["type"];

/** Build latest row per `doc_type` (caller should pass rows ordered by `uploaded_at` desc). */
export function mapLatestVaultRowByDocType<T extends { doc_type: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {};
  for (const row of rows) {
    if (!(row.doc_type in map)) map[row.doc_type] = row;
  }
  return map;
}

/**
 * Resolve the document row for a UI slot (`selfie` accepts `BORROWER_SELFIE_VAULT_ALIASES`).
 */
export function vaultDocForSlot<T extends { doc_type: string }>(
  byDocType: Record<string, T | undefined>,
  slotType: BorrowerVaultKycDocType,
): T | undefined {
  if (slotType === "selfie") {
    for (const alias of BORROWER_SELFIE_VAULT_ALIASES) {
      const doc = byDocType[alias];
      if (doc) return doc;
    }
    return undefined;
  }
  return byDocType[slotType];
}

/**
 * Latest row wins per doc_type (caller should pass rows ordered by uploaded_at desc).
 */
export function latestVerifiedByVaultDocType(
  docs: Array<{ doc_type: string; is_verified: boolean | null }>,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of docs) {
    if (!(d.doc_type in map)) map[d.doc_type] = !!d.is_verified;
  }
  return map;
}

/** True when NRC front+back and any accepted selfie vault doc are verified. */
export function borrowerIdentityKycSatisfiedFromVault(
  docs: Array<{ doc_type: string; is_verified: boolean | null }>,
): boolean {
  const m = latestVerifiedByVaultDocType(docs);
  if (!m.nrc_front || !m.nrc_back) return false;
  return BORROWER_SELFIE_VAULT_ALIASES.some((t) => m[t] === true);
}

/** All three slots have at least one upload (selfie slot accepts aliases). */
export function borrowerVaultCoreSlotsUploaded(docTypes: Iterable<string>): boolean {
  const set = new Set(docTypes);
  const hasSelfie = BORROWER_SELFIE_VAULT_ALIASES.some((t) => set.has(t));
  return set.has("nrc_front") && set.has("nrc_back") && hasSelfie;
}

/**
 * Normalize a document label/type to a comparable key: lowercase, alphanumeric only.
 * Used to match historical documents (vault + previous loans) to checklist slots
 * regardless of underscores/spacing differences (e.g. "NRC (Front)" -> "nrcfront").
 */
export function normalizeDocKey(value: string): string {
  return (value || "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

/**
 * Groups of normalized doc keys that should be treated as equivalent when matching
 * historical documents to a checklist slot (identity docs are named inconsistently
 * across the KYC vault and per-product checklists).
 */
const DOC_ALIAS_GROUPS: string[][] = [
  ["selfie", "selfieholdingnrc", "selfiewithnrc", "nrcselfie", "selfienrc"],
  ["nrcfront", "nrcfrontside", "nationalidfront", "idfront", "nrccopyfront"],
  ["nrcback", "nrcbackside", "nationalidback", "idback", "nrccopyback"],
];

/** Return all normalized keys equivalent to the given normalized key (incl. itself). */
export function equivalentDocKeys(normalizedKey: string): string[] {
  for (const group of DOC_ALIAS_GROUPS) {
    if (group.includes(normalizedKey)) return group;
  }
  return [normalizedKey];
}
