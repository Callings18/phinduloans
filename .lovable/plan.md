

## Plan: 6 Fixes — Disbursement Access, Reloan, Documents, Duplicate Prevention, Receipt Branding, Signature Removal

### 1. Block Loan Officers from Disbursing

**Problem**: Loan officers can create and complete disbursements via the Disbursements page. The permission check uses `can("disbursement", "disburse")` and `can("disbursement", "create")`, but if these permissions are assigned to the loan_officer role, they can act.

**Fix**:
- In `AdminDisbursements.tsx`, add an explicit `isAdmin` gate: loan officers see the page (read-only view of disbursement status) but both the "New Disbursement" button and the "Complete/Fail" actions are hidden unless `isAdmin` is true.
- Also gate the disburse action in `AdminApplications.tsx` the same way — the "Disburse" button in the application detail view should only appear for admin/finance roles.

**Files**: `src/pages/admin/AdminDisbursements.tsx`, `src/pages/admin/AdminApplications.tsx`

---

### 2. Add "Reloan" Feature (Admin Only)

**Problem**: When a borrower pays off interest and wants to reloan the same principal, the admin currently has to clear the loan, create a new one, and it behaves as a brand new loan (deducting from bank account again).

**Fix**:
- Add a "Reloan" button in `LoanDetailsModal.tsx` (Overview tab, quick actions area), visible only to admins (`isAdmin` check).
- Reloan logic:
  1. Mark the current loan as `completed` (or a new status `reloaned`).
  2. Create a new `loan_application` record copying key fields (borrower, product, amount, term) from the original loan with status `approved` and a reference note like "Reloan of [original_id]".
  3. Do NOT create a disbursement or deduct from any account — the money is already with the borrower.
  4. Auto-generate a new repayment schedule for the new loan.
  5. Show a confirmation dialog explaining what will happen.

**Files**: `src/components/admin/LoanDetailsModal.tsx`

---

### 3. Fix Document Matching (Uploaded Docs Showing as "Other")

**Problem**: The `ApplicationDocumentsTab` matching logic compares `d.docType.toUpperCase()` against `reqDoc.document_type.toUpperCase()`, but when documents are uploaded via the admin upload form, the `doc_type` is saved as a lowercase key (e.g., `nrc_front`) derived from `document_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()`. Meanwhile, the product's `document_type` may be `NRC_FRONT` (uppercase slug generated from the name). This should match, BUT vault KYC docs use types like `nrc_front` which get mapped via `vaultToProductType` to `NRC_FRONT`. The issue is that admin-uploaded docs use arbitrary keys like `nrc_front` from `docKey` and the product type is `NRC_FRONT` — these should match case-insensitively, which they do.

The real issue: when docs are uploaded during loan creation (line 361-381 in AdminApplications), `doc_type` is set to `docKey` = `document_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()`, e.g. `"nrc_front"`. But the product's `document_type` might be stored differently (e.g. `"NRC_FRONT"` or `"nrc-front"`). The matching at line 236 does `toUpperCase()` comparison which should work. 

Let me look more carefully — the `extraDocs` filter at line 262-265 checks `!requiredTypes.has(d.docType.toUpperCase())`. So if a vault KYC doc is mapped to `NRC_FRONT` but the product doesn't have that exact type, it shows as extra. The vault mapping only covers a few types. If the product has a type like `SELFIE_HOLDING_NRC` but the vault doc type is `selfie` mapped to `SELFIE`, they won't match.

**Fix**: Expand the matching logic in `ApplicationDocumentsTab.tsx`:
- Add more mappings to `vaultToProductType` for common variations.
- Normalize both sides more aggressively: strip underscores/hyphens, compare base forms.
- Add alias matching: `SELFIE` should match `SELFIE_HOLDING_NRC`, `PAYSLIP` should match `PAYSLIP_1`, `PAYSLIP_LATEST`, etc.

**Files**: `src/components/admin/ApplicationDocumentsTab.tsx`

---

### 4. Prevent Duplicate Active Loans for Same Borrower

**Problem**: The system allows creating a new loan for a borrower who already has an active (pending/approved/disbursed) loan.

**Fix**:
- In `AdminApplications.tsx` `createLoanMutation`, before inserting, query `loan_applications` for the selected borrower where `status IN ('pending', 'under_review', 'approved', 'awaiting_disbursement', 'disbursed')`. If any exist, throw an error: "This borrower already has an active loan. Please close or complete it first."
- Also check the product's `max_concurrent_loans` setting if available.

**Files**: `src/pages/admin/AdminApplications.tsx`

---

### 5. Change Receipt Colors to Phindu Branding

**Problem**: `generateRepaymentReceipt.ts` uses blue (`59, 130, 246`) for headers and amount boxes.

**Fix**: Replace with Phindu burgundy/maroon (`107, 26, 58`) — matching the contract PDF and app theme. Update header, amount box, and footer accent colors.

**Files**: `src/utils/generateRepaymentReceipt.ts`

---

### 6. Remove Automatic Director Signature from Contract

**Problem**: The contract generation embeds a director signature image automatically (lines 382-389 of `generateLoanContract.ts`). The user has found a way to sign manually.

**Fix**: Remove the `directorSignatureImg` import and the `doc.addImage(directorSignatureImg, ...)` block. Replace with a signature line for the director to sign manually (same as borrower side).

**Files**: `src/utils/generateLoanContract.ts`

---

### Summary of Files to Modify

| File | Changes |
|------|---------|
| `AdminDisbursements.tsx` | Gate create/complete actions behind `isAdmin` |
| `AdminApplications.tsx` | Gate disburse button behind `isAdmin`; add active loan duplicate check |
| `LoanDetailsModal.tsx` | Add admin-only "Reloan" button and logic |
| `ApplicationDocumentsTab.tsx` | Improve document type matching/normalization |
| `generateRepaymentReceipt.ts` | Change blue to burgundy (#6B1A3A) |
| `generateLoanContract.ts` | Remove auto director signature, add manual signature line |

