

# Revised Borrower Portal Plan (Following Your Document)

## Summary of Changes from Previous Plan

Your document correctly identified 6 problems. Here's the revised plan addressing all of them:

1. **ONE application flow** (`/apply`) -- not two parallel paths
2. **JSONB `product_specific_data` column** -- not admin_notes hacks
3. **Admin UI shows product-specific data** -- end-to-end visibility
4. **Loan history deferred to Phase 2** -- focus on critical path
5. **QuickApply becomes a calculator** that redirects to `/apply`

---

## PHASE 1: Critical Path (This Implementation)

### Task 1.1: Enable Contract Signing (5 min)

- Uncomment `<ContractSigningWidget userId={user.id} />` on Dashboard line ~513
- Import already exists, just needs the JSX render restored

### Task 1.2: Database Migration

```sql
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS product_specific_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_loan_applications_product_data
ON loan_applications USING gin (product_specific_data);
```

One new column. No schema disruption. Admin queries unchanged.

### Task 1.3: Build Complete `/apply` Multi-Step Form (~8 hours)

Convert `src/pages/Apply.tsx` from a "please log in" placeholder into a full multi-step application form for authenticated users. Unauthenticated users still see the current "log in first" page.

**Step 1: Select Product**
- Fetch active `loan_products` from database
- Show 3 products as cards with name, description, rate, min/max amounts, requirements summary
- Borrower selects one to proceed

**Step 2: Loan Details + Product-Specific Fields**
- Amount slider (bounded by product min/max)
- Term slider (bounded by product min/max term)
- Loan purpose selector
- **Conditional fields by product:**
  - **Salary Advance**: Employer name, employer contact, monthly salary (stored in `product_specific_data`)
  - **Collateral Loan**: Collateral description, estimated value, collateral images (uses existing `collateral_description`, `collateral_value`, `collateral_image_url` columns)
  - **Business Loan**: Business name, TPIN, registration number, business type (stored in `product_specific_data`)
- Live loan calculation preview using existing `calculateLoan()`

**Step 3: Document Upload**
- Dynamic checklist driven by `product.required_documents` JSONB
- Each required doc gets a file upload slot with validation (type, size)
- Files upload to `loan-documents` storage bucket
- Rows inserted into `application_documents` table (borrower INSERT RLS exists)
- Map known doc types to `loan_applications` columns where applicable (e.g., `payslip_url`, `bank_statement_url`, `collateral_image_url`)

**Step 4: Review & Submit**
- Full summary: personal info (from profile), loan details, product-specific fields, uploaded docs list
- Loan calculation breakdown (monthly payment, total repayment, fees)
- CRB consent checkbox + terms consent
- Submit: INSERT into `loan_applications` with all fields + `product_specific_data` JSONB

**Data flow on submit:**
```
loan_applications row:
  - Standard fields: full_name, email, phone, nrc_number, loan_amount, loan_term_months, etc.
  - Product columns: collateral_description, collateral_value, collateral_image_url (for collateral loans)
  - JSONB column: product_specific_data = {"business_name": "...", "business_tpin": "...", ...}
  - source = 'website'

application_documents rows:
  - One row per uploaded document (doc_type, file_url, borrower_id, application_id)
```

### Task 1.4: Convert QuickApply to Calculator Redirect

Modify `QuickApply` component on Dashboard:
- Keep the product selection and amount/term sliders
- Remove the submission logic
- Change "Apply" button to navigate to `/apply?product={id}&amount={amount}&term={term}`
- `/apply` reads query params and pre-fills Step 1 + Step 2

This eliminates the dual-flow problem while keeping the quick interaction on Dashboard.

### Task 1.5: Admin UI for Product-Specific Data (4 hours)

In `AdminApplications.tsx` detail view (and `LoanDetailsModal.tsx`), add a **"Product-Specific Information"** card that reads `product_specific_data` JSONB:

- **Business Loan**: Show Business Name, TPIN, Registration Number, Business Type
- **Salary Advance**: Show Employer Name, Employer Contact, Monthly Salary
- **Collateral Loan**: Already shown via existing `collateral_description`/`collateral_value` fields -- no change needed

This is a read-only display section. The admin detail view already shows uploaded `application_documents` via `ApplicationDocumentsTab`, so all borrower-uploaded docs are already visible to admins.

---

## What Does NOT Change (Admin Side Untouched)

- All admin pages, approval workflows, disbursement flows -- zero changes
- `LoanDetailsModal` internal logic (reloan/top-up/restructure) -- untouched
- Edge functions, notification system -- untouched
- Existing RLS policies -- untouched (borrower INSERT/SELECT already exist)
- `supabase/config.toml`, `client.ts`, `types.ts` -- untouched

## PHASE 2 (Deferred -- After Phase 1 Works)

- Loan history visibility for borrowers (RLS on `loan_events` + timeline UI)
- Payment portal / online payments
- Enhanced polish features

## Implementation Order

1. Database migration (`product_specific_data` JSONB column)
2. Enable ContractSigningWidget (1 line uncomment)
3. Build `/apply` multi-step form (the main work)
4. Convert QuickApply to calculator redirect
5. Add product-specific data display in admin detail view
6. End-to-end testing: all 3 loan products through complete flow

