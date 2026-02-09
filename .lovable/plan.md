

# Confirmation: Borrower vs Admin Flow Alignment -- Gap Analysis & Fix Plan

## Current State Assessment

After a comprehensive audit of every relevant file, here is the status of each item in your specification:

---

## Items Already Fully Implemented (No Changes Needed)

| Feature | Status | Where |
|---|---|---|
| Account creation (email + password + OTP) | Done | `Auth.tsx`, `useAuth.tsx`, `verify-otp`, `send-otp` edge functions |
| Phone normalization to E.164 | Done | `authHelpers.ts` used in `useAuth.tsx` |
| OTP login with proper error messages | Done | `sendOtp` in `useAuth.tsx` checks profiles + loan_applications tables |
| Duplicate NRC + phone prevention | Done | DB unique index `idx_profiles_nrc_phone_unique` |
| Auth event logging (LOGIN/SIGNUP) | Done | `useAuth.tsx` calls `supabase.rpc('log_auth_event')` |
| Borrower dashboard with real-time updates | Done | `Dashboard.tsx` subscribes to `postgres_changes` |
| Loan product configuration (interest, fees, terms, CRB, PMIC, documents, locations) | Done | `AdminLoanProducts.tsx`, `loan_products` table |
| Product-driven required documents | Done | `Apply.tsx` reads `required_documents` JSONB from product |
| Location eligibility enforcement | Done | `Apply.tsx` blocks submission if city not in `eligible_locations` |
| Duplicate loan prevention | Done | Both borrower (`existingActiveLoan` query) and admin side (`borrowerExistingLoan` query) |
| Status pipeline includes `contract_signing` | Done | DB enum, `ApplicationStatusTracker.tsx`, `AdminLoans.tsx`, `LoanDetailsModal.tsx` |
| Borrower status messages per stage | Done | `ApplicationStatusTracker.tsx` lines 296-312 |
| Contract signing widget (signature pad + upload) | Done | `ContractSigningWidget.tsx` with dual signature |
| Admin counter-signature verification | Done | `LoanDetailsModal.tsx` lines 1147-1280 |
| Disbursement locked until dual signature | Done | Admin must verify `borrower_signed` + `admin_signed` before disburse |
| Disbursement source account balance check | Done | `AdminLoans.tsx` line 649 checks balance |
| Account transaction ledger on disburse | Done | `AdminLoans.tsx` records to `account_transactions` |
| Repayment schedule auto-generation | Done | DB trigger `generate_repayment_schedule` |
| Penalty calculation and auto-apply | Done | DB functions `calculate_repayment_penalty`, `apply_loan_penalties` |
| Early settlement calculation | Done | DB function `calculate_early_settlement` |
| Loan restructuring | Done | `LoanDetailsModal.tsx` restructure mutation |
| Payment reversal | Done | `LoanDetailsModal.tsx` reversal mutation |
| Notifications per stage (approval, rejection, disbursement, payment) | Done | DB triggers + `send_notification_via_edge_function` |
| Admin dashboard KPIs (due today, blacklisted, principal/interest split, defaulted) | Done | `AdminDashboard.tsx` lines 75-155 |
| Blacklist with duration support | Done | `AdminBorrowers.tsx` with `blacklist_expires_at` |
| Blacklist enforcement on Apply page | Done | `Apply.tsx` checks `is_blacklisted` and `blacklist_expires_at` |
| Document Vault for borrower reuse | Done | `Apply.tsx` queries `borrower_document_vault` |
| Admin document verification tab (payslip passwords shown) | Done | `DocumentVerificationTab.tsx` |
| Borrower document checklist during Under Review | Done | `DocumentChecklist.tsx` shown in `Dashboard.tsx` |
| Collections, court cases, write-offs | Done | Dedicated modules |
| Role-based admin sidebar | Done | 7+ staff roles |
| Capital pool widget on admin dashboard | Done | `CapitalPoolWidget.tsx` |

---

## Remaining Gaps Found (Fixes Needed)

### Gap 1: Admin disbursement does NOT check `admin_signed` before allowing disbursement

**Problem:** The disbursement mutation in `AdminLoans.tsx` (line 641-728) does not verify that `admin_signed === true` before proceeding. The contract signing verification card exists in `LoanDetailsModal.tsx`, but the actual disbursement button in the main loans table can bypass it.

**Fix:** Add a guard in the `handleDisburse` function and the disbursement dialog to check `selectedLoan?.admin_signed === true` before allowing disbursement. Show an error toast: "Contract must be signed by both parties before disbursement."

### Gap 2: Admin "Approve" does not auto-transition to `contract_signing`

**Problem:** When admin clicks Approve, status goes to `approved` (line 857). But per the spec, after contract is generated and sent, it should move to `contract_signing`. Currently there is no explicit step to move from `approved` to `contract_signing` -- the borrower sees both statuses as valid for signing.

**Fix:** After approval, when admin generates and sends the contract (via the contract download/share actions in `LoanDetailsModal.tsx`), automatically update status to `contract_signing`. Add a "Generate & Send Contract" button that transitions the status.

### Gap 3: `contract_signing` status missing from `AdminLoans.tsx` applications tab filter

**Problem:** The applications tab in `AdminLoans.tsx` filters loans by specific statuses but does not explicitly include `contract_signing` in the visible tabs/filters. Loans in `contract_signing` status may not appear in any tab.

**Fix:** Ensure `contract_signing` appears in the Applications tab alongside `pending`, `under_review`, and `approved`.

### Gap 4: Document verification status update by admin not propagating to borrower checklist

**Problem:** The admin `DocumentVerificationTab.tsx` uses a `document_checklist` table for verification status, but the borrower `DocumentChecklist.tsx` reads from `application_documents`. The `status` column on `application_documents` may not be updated when admin verifies/rejects via the checklist.

**Fix:** Ensure the admin verification action updates the `status` field on the `application_documents` table row (not just a separate checklist table). This way, the borrower's `DocumentChecklist.tsx` sees the correct verified/rejected status.

### Gap 5: Missing "Upload Signed Contract" option for borrower

**Problem:** The `ContractSigningWidget.tsx` only supports digital signature pad capture. The spec requires borrowers to also be able to "Download + sign manually + upload" as an alternative.

**Fix:** Add a file upload option alongside the signature pad in the signing dialog. Allow borrower to upload a scanned/photographed signed contract PDF/image.

### Gap 6: Signature pad dark mode visibility

**Problem:** The spec requires the signature pad to temporarily switch to light mode for visibility. The `SignaturePad` component needs verification that it forces a white background.

**Fix:** Ensure the `SignaturePad` component forces a white canvas background regardless of theme, and the dialog container also has light styling during signing.

---

## Implementation Plan

### Step 1: Add disbursement guard for dual signature (Gap 1)

**File:** `src/pages/admin/AdminLoans.tsx`

- In the `handleDisburse` function (around line 876), add a check:
  ```
  if (!selectedLoan?.borrower_signed || !selectedLoan?.admin_signed) {
    toast.error("Contract must be signed by both parties before disbursement");
    return;
  }
  ```
- Also disable the "Disburse" button in the UI when signatures are incomplete

### Step 2: Add "Generate & Send Contract" action to transition to `contract_signing` (Gap 2)

**File:** `src/components/admin/LoanDetailsModal.tsx`

- Add a prominent "Generate & Send Contract" button when status is `approved`
- When clicked: generate the contract PDF, send via Email/SMS/WhatsApp, then update status to `contract_signing`
- This makes the transition explicit and auditable

### Step 3: Include `contract_signing` in applications tab filter (Gap 3)

**File:** `src/pages/admin/AdminLoans.tsx`

- Update the applications tab filter to include `contract_signing` alongside `pending`, `under_review`, `approved`, and `rejected`
- Ensure `contract_signing` loans show in the "Applications" view with proper badge

### Step 4: Sync admin document verification with borrower checklist (Gap 4)

**File:** `src/components/admin/DocumentVerificationTab.tsx`

- When admin marks a document as "Verified" or "Rejected", also update the corresponding `application_documents` row's `status` field
- Add `notes` (rejection reason) update to `application_documents` so borrower sees the reason

### Step 5: Add contract upload option for borrower (Gap 5)

**File:** `src/components/dashboard/ContractSigningWidget.tsx`

- Add a "Or upload signed contract" section below the signature pad
- Accept PDF/image files
- Upload to `loan-documents` storage bucket
- Update `signed_contract_url`, `borrower_signed`, `borrower_signed_at` same as signature flow
- Notify admin same as digital signature

### Step 6: Ensure signature pad white background (Gap 6)

**File:** `src/components/common/SignaturePad.tsx`

- Verify the canvas has `backgroundColor: 'white'` forced
- Ensure the signing dialog wrapper has light theme styling during signing (white background, dark text)

---

## Technical Details

### Files to Modify

| File | Gap | Change Description |
|---|---|---|
| `src/pages/admin/AdminLoans.tsx` | 1, 3 | Add dual-signature guard on disburse; include `contract_signing` in Applications filter |
| `src/components/admin/LoanDetailsModal.tsx` | 2 | Add "Generate & Send Contract" button that transitions `approved` to `contract_signing` |
| `src/components/admin/DocumentVerificationTab.tsx` | 4 | Sync verification status to `application_documents` table |
| `src/components/dashboard/ContractSigningWidget.tsx` | 5 | Add file upload alternative for signed contract |
| `src/components/common/SignaturePad.tsx` | 6 | Force white canvas background |

### No Database Changes Required

All needed columns and tables already exist. The `contract_signing` enum value was added in the previous migration. The `application_documents` table already has a `status` column.

### Implementation Order

1. Signature pad white background (quick fix)
2. Contract upload option for borrower (enhances UX)
3. Disbursement dual-signature guard (critical security)
4. Admin "Generate & Send Contract" transition
5. Applications tab filter update
6. Document verification sync

