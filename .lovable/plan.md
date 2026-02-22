

## Plan: Fix Loan Officer Access, Contract Versioning, and Restore Penalty Configuration

### Issue 1: Loan Officer Sidebar Visibility and Permissions

**Problem**: The sidebar currently shows all menu items to every staff role, including "Accounts" (financial data) which the loan officer should not see. The loan officer also cannot see loan status defaults and other operational data.

**Fix**:
- Update `AdminSidebar.tsx` to filter menu items based on the user's role
- Hide "Accounts", "Roles & Permissions", and "Settings" from loan officers
- Keep all Lending and most Operations items visible to loan officers
- The loan officer should see: Dashboard, Applications, Borrowers, Loan Products, Loans, Disbursements, Repayments, Contract Templates, User Guide

### Issue 2: Loan Officers See Old/Regenerated Contracts

**Problem**: The `Loan` interface in `AdminLoans.tsx` does not include `contract_url` or `signed_contract_url`. When a loan is passed to `LoanDetailsModal`, these fields are missing, so the modal always regenerates the contract from the template instead of fetching the stored version.

**Fix**:
- Add `contract_url`, `signed_contract_url`, `signed_contract_uploaded_at`, `borrower_signed`, `borrower_signed_at`, `admin_signed`, `admin_signed_at`, and `contract_fully_signed_at` fields to the `Loan` interface in `AdminLoans.tsx`
- The query already uses `select("*")` so the data is already fetched -- only the TypeScript interface is incomplete, causing it to be silently dropped when cast

### Issue 3: Penalty and Fee Configuration Missing from Loan Products

**Problem**: The product form hides all advanced fields (penalties, grace period, enforcement fees, insurance, VAT, platform fees, early repayment fees, etc.) behind `{false && (...)}` at line 998 (labeled "V2 Advanced Fields"). The default form data has the values but the UI inputs are not rendered.

**Fix**:
- Restore the penalty and fee configuration fields to the product creation/edit form
- Add a collapsible "Fees & Penalties" section with:
  - Late Payment Penalty Rate (%)
  - Penalty Frequency (daily/weekly/monthly/one-time)
  - Grace Period (days)
  - Enforcement Fee (%)
  - Insurance Fee (%)
  - VAT (%)
  - Platform Fee (%)
  - Early Repayment Fee (%)
- These fields already exist in `defaultFormData` and are saved in `handleSubmit`, so only the UI inputs need to be restored

---

### Technical Details

**Files to modify**:

1. **`src/components/admin/AdminSidebar.tsx`**
   - Import `useAuth` (already imported) and use `hasRole` or `isAdmin` to conditionally filter menu items
   - Add a `roles` or `adminOnly` flag to sensitive menu items (Accounts, Roles & Permissions, Settings)
   - Filter them out for `loan_officer` role

2. **`src/pages/admin/AdminLoans.tsx`**
   - Extend the `Loan` interface (lines 66-93) to include contract-related fields: `contract_url`, `signed_contract_url`, `signed_contract_uploaded_at`, `borrower_signed`, `borrower_signed_at`, `admin_signed`, `admin_signed_at`, `contract_fully_signed_at`

3. **`src/pages/admin/AdminLoanProducts.tsx`**
   - Replace the `{false && (...)}` block (line 998) with a visible, collapsible "Fees, Penalties & Advanced" section
   - Add input fields for: `late_payment_penalty_percent`, `penalty_frequency`, `grace_period_days`, `enforcement_fee_percent`, `insurance_percent`, `insurance_required`, `vat_percent`, `platform_fee_percent`, `early_repayment_fee_percent`, `early_repayment_allowed`
   - Group them in a `Collapsible` or `details` element so the form stays clean

