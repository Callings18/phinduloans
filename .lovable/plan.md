# Reuse historical documents for repeat borrowers

Make the loan creation form (all houses) offer a returning borrower's existing documents for reuse, so officers only upload what genuinely changed. Marketeers benefit most, but per your choice this applies to **all loan houses**.

## Behavior (what the officer sees)

When a borrower is selected for a new loan:

- If the borrower has a **previous completed/paid-off loan**, each required document slot that we can satisfy from history shows a **"Reuse previous document?"** state with the source file name and a **Reuse** button + an **Upload new** button.
- Nothing is silently auto-attached anymore. The officer **confirms reuse per slot** (or uploads a fresh file). A "Reuse all" shortcut confirms every available slot at once.
- Slots with no history behave exactly as today (Upload / Camera).
- If the borrower has **no completed loan yet**, reuse is not offered (first-time flow unchanged).

```text
┌ NRC Front ────────────────────────────────┐
│ Found from previous loan: nrc_front.jpg    │
│  [ Reuse this ]   [ Upload new ]           │
└────────────────────────────────────────────┘
```

After a slot is reused it shows a green "Reused from previous loan ✓" badge with an option to undo / replace.

## Where documents are pulled from (vault + last loan)

For the selected borrower, build one merged map of available historical docs, preferring the most recent:

1. **Document vault** (`borrower_document_vault`) — current source.
2. **Last completed loan's documents** (`application_documents` for that borrower whose `application_id` belongs to a `loan_applications` row with `status = 'completed'`), newest first.

Merge both, dedupe per slot, newest `uploaded_at` wins.

## Alias-aware slot matching

Replace the brittle exact-label match with a normalizer so vault/last-loan docs reliably land in the right checklist slot:

- Normalize both the checklist label and the stored `doc_type`/`doc_label` (lowercase, strip non-alphanumerics) before matching — mirrors the `sanitizedLabel` already used on upload.
- Honor identity aliases from `src/constants/borrowerKycDocs.ts` (e.g. `selfie` ⇄ `selfie_holding_nrc`) so the selfie slot fills from any accepted variant.

## Eligibility gate

Only surface reuse when the borrower has at least one `loan_applications` row with `status = 'completed'`. (DB confirmed `completed` is the paid-off status.) Otherwise the form stays in first-time mode.

## Submit logic

Keep the existing `uploadDocuments` flow, but only link a historical doc for slots the officer **explicitly confirmed for reuse** (tracked in a `reusedDocs` map) instead of every vault doc. Re-uploaded files still take priority and replace the slot.

## Technical changes

- `src/components/admin/ProductLoanFormShell.tsx`
  - Add a `historicalDocs` fetch (vault + last completed loan) and a `hasCompletedLoan` flag, replacing the current vault-only effect (lines ~302–320).
  - Add alias-aware slot resolution helper (reuse logic from `borrowerKycDocs.ts`).
  - Add `reusedDocs` state; render per-slot Reuse / Upload-new UI + "Reuse all" in the Documents tab (lines ~1853–1950).
  - Update `allDocsProvided`, the attached-count, and the borrower summary chip to count confirmed reuse instead of raw vault count.
  - Update `uploadDocuments` (lines ~732–754) to link only confirmed `reusedDocs`.
- `src/constants/borrowerKycDocs.ts` — small exported helper for normalized/alias slot matching if not already covered (no schema change).

No database migrations required — all tables and columns already exist.

## Out of scope

- No change to how first-time documents are collected or to KYC verification rules.
- No backend/edge-function changes.
