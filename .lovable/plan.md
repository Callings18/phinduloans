# Collateral Loans: Borrower-side visibility + Joint Borrower Structure

Two related changes, both **scoped to the Collateral product only**. Other products (Salary Advance, Payday Soft, Marketeer, Business, Motor Vehicle, Guarantor, Staff) are untouched.

---

## Part A — Borrower-side dashboard reflects the new Collateral config

The previous change exposed the 30% flat / 1–6 month rule on the admin side. Now mirror it on the borrower's loan application form.

**File:** `src/components/dashboard/LoanApplicationForm.tsx`

1. When the selected product is **Collateral** (`product_code === "COLLATERAL"` or `collateral_required === true`):
   - Replace the term **slider** with a 1–6 month **dropdown** (same UX as admin shell).
   - Add a small disclosure under the summary:
     > "Collateral loans carry a fixed 30% total interest regardless of term. Choose 1–6 months — your monthly payment changes, total cost stays the same."
2. The Loan Summary already calls `calculateLoan()`, which now handles `interest_period === "per_loan"` correctly — no math changes needed; just verify the displayed monthly payment matches the validation matrix from earlier (P=10,000 → K3,000 total interest at any term).
3. No changes for any other product.

---

## Part B — Co-Borrower + Absolute Owner support (Collateral only)

### B1. Database extension (additive, non-breaking)

New table — does **not** touch `loan_applications`:

```sql
create type public.loan_borrower_role as enum (
  'PRIMARY_BORROWER', 'CO_BORROWER', 'ABSOLUTE_OWNER', 'GUARANTOR'
);

create table public.loan_borrowers (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references loan_applications(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  -- snapshot fields so we can capture non-borrower absolute owners who aren't system users
  full_name text not null,
  nrc_number text not null,
  phone text,
  address text,
  role public.loan_borrower_role not null,
  is_signatory boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index on public.loan_borrowers (loan_application_id);
create unique index loan_borrowers_one_primary_per_loan
  on public.loan_borrowers (loan_application_id)
  where role = 'PRIMARY_BORROWER';
```

RLS:
- Borrower can `select` rows where they are the loan owner (`loan_applications.user_id = auth.uid()`).
- Borrower can `insert` rows for their own application while it is still `pending`/`draft`.
- Admin / loan officer roles (via existing `has_role()` patterns) can full CRUD.

A trigger enforces: `role` rows other than `PRIMARY_BORROWER` may only be added when the linked application's `loan_product_id` resolves to `product_code = 'COLLATERAL'`. This is the hard isolation guarantee.

### B2. Loan engine / repayment

**Zero changes.** `calculateLoan()`, `loan_repayments`, schedule generation, disbursement totals — all stay single-loan, single-schedule. Borrowers are jointly and severally liable but share one schedule.

### B3. Frontend — Collateral application screens

Add a new shared component:

- `src/components/loans/CollateralBorrowersSection.tsx`
  - Renders three sub-sections: **Primary Borrower** (auto-filled from current user / selected admin borrower, locked role), **Co-Borrowers** (add/remove rows), **Absolute Owners** (add/remove rows).
  - Each row: full name, NRC, phone, address, "Signatory required" checkbox (default on).
  - Live summary card listing everyone grouped by role.
  - Validation: ≥1 primary, ≥1 signatory total, NRC format valid (existing helper), warns on duplicate NRC across roles.

Mount this component **only** when collateral:

1. **Borrower side** — `src/components/dashboard/LoanApplicationForm.tsx`, inside the existing `isCollateralLoan` block in Step 1. Persist the array in component state; on submit, after `loan_applications.insert(...)` returns the id, batch-insert into `loan_borrowers`.
2. **Admin side** — `src/components/admin/ProductLoanFormShell.tsx`, only when `productCode === "COLLATERAL"`. Same component, same persistence path.

No other product form imports the component → guaranteed isolation.

### B4. Contract generation

**File:** `src/utils/generateLoanContract.ts`

1. After `fetchActiveTemplate`, if the loan is collateral, fetch `loan_borrowers` for that application.
2. New placeholders (only meaningful for collateral templates; harmless otherwise):
   - `{{borrowers_block}}` — multi-line list of all primary + co-borrowers (Name / NRC / Role).
   - `{{absolute_owners_block}}` — list of absolute owners with the legal clause:
     > "The Absolute Owner(s) named below acknowledge their collateral is pledged as security for this loan."
   - `{{joint_liability_clause}}` — fixed paragraph stating joint and several liability.
3. In the **default PDF builder** (`createDefaultContractPDF`) for collateral loans:
   - Replace the single "BORROWER" block in section 1 with iterated blocks per `loan_borrowers` row (Name, NRC, Phone, Role).
   - Add a new section **"COLLATERAL OWNERSHIP"** listing absolute owners.
   - Add a **"JOINT AND SEVERAL LIABILITY"** clause.
   - Replace the single signature line with one signature block per `is_signatory = true` row (dynamic count, not fixed).
4. Non-collateral contracts use the existing single-borrower path unchanged.

### B5. Validation summary

| Rule | Where enforced |
|---|---|
| At least one PRIMARY_BORROWER | DB unique partial index + UI |
| Only one PRIMARY per loan | DB unique partial index |
| At least one signatory | UI + submit guard |
| Co-Borrower / Absolute Owner only on Collateral | DB trigger + UI gating |
| Non-collateral flows unchanged | Component is only imported by collateral paths |

### B6. Test cases

- **Case 1**: 1 primary + 1 absolute owner → contract renders 2 signature blocks; one `loan_repayments` schedule.
- **Case 2**: 1 primary + 2 co-borrowers + 1 absolute owner → 4 signature blocks; one schedule.
- **Negative**: Attempt to insert `CO_BORROWER` against a salary-advance application → DB trigger rejects.
- **Regression**: Submit a Salary Advance and a Marketeer application — no `loan_borrowers` rows created, contract output byte-identical to before.

---

## Files to be created / edited

**New**
- `supabase` migration for `loan_borrower_role`, `loan_borrowers`, RLS, trigger
- `src/components/loans/CollateralBorrowersSection.tsx`

**Edited**
- `src/components/dashboard/LoanApplicationForm.tsx` (Part A dropdown + disclosure; Part B section mount + persist)
- `src/components/admin/ProductLoanFormShell.tsx` (Part B section mount + persist when `COLLATERAL`)
- `src/utils/generateLoanContract.ts` (collateral-only borrower iteration + new placeholders + dynamic signatures)

**Untouched (explicit isolation)**
- `src/utils/loanCalculations.ts`
- `src/lib/marketeerCalculations.ts`
- `loan_repayments`, schedule logic, disbursement logic
- All non-collateral product forms

---

## Confirmation of safety

- No change to interest, fees, repayment math, or schedule generation.
- New table is additive; existing `loan_applications.user_id` (primary borrower) remains the source of truth for the loan owner.
- All multi-borrower logic is gated on `product_code = 'COLLATERAL'` at three layers: UI mount, DB trigger, contract branch.
- Other loan products’ submit payloads, contracts, and PDFs are unchanged.

Approve and I’ll implement Part A + Part B in order (migration first, then UI, then contract generator), with the regression test for Salary Advance contract output included.