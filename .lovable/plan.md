
# Phone-Only Auth + Custom Loan Product Builder

Two large changes in one pass. I'll deliver them in clear phases so the migration is safe.

---

## Part 1 — Phone-only auth (borrowers + admin)

### What changes for users
- `/auth` and `/admin/login` will show **only** the phone-number + OTP flow. No email or password fields, no "Use email instead" toggle.
- Sign-up (borrower) collects: Full name, Phone, NRC. OTP is sent to the phone, code verifies, account is created. No email, no password.
- Login (everyone, including admin/staff) is the same single screen: phone → OTP → routed to admin or borrower dashboard based on roles.
- Forgot-password flow is removed (nothing to recover — OTP is the credential).
- "Welcome" SMS replaces the welcome email everywhere a new user is provisioned.

### Migration safety for existing email/password users
- Every existing admin and staff account already has a `profiles.phone` (we verified during the marketeer fix). Anyone missing a phone gets a one-time prompt to set one when an admin opens their record — same UX as today's "missing phone" warning. A super-admin RPC `set_user_phone(user_id, phone)` is added for the rare lockout case.
- Server side, `auth.users.email` is kept as-is (Supabase still requires *something* on the row) but is never displayed and never used to log in. Edge function `verify-otp` already returns a magic-link session by phone, so no password is ever asked.
- `handle_new_user` trigger keeps storing `email = null` in `public.profiles` when the auth email is a synthetic `…@phone.phindu.local` placeholder.

### Code changes
- `src/pages/Auth.tsx` → strip the email/password tabs; render `PhoneAuthForm` directly for both `signup` and `login`. Remove "Forgot password?" link.
- `src/components/auth/PhoneAuthForm.tsx` → drop the `complete_signup` step's email + password fields. Signup collects only Full Name (NRC moves to profile completion after first login). Keep OTP.
- `src/pages/admin/AdminLogin.tsx` (if present) → same phone-only form, no email tab.
- `src/hooks/useAuth.tsx` → remove `signInWithEmail`, `signUpWithEmail`, `resetPassword` exports. Keep `signOut`, `signInWithPhone`.
- Delete unused: `/reset-password` page, `ForgotPassword` modal, email-related toggles in nav.
- `supabase/functions/verify-otp/index.ts` → when creating a new user, synthesize `email = "${phone}@phone.phindu.local"`, set `profiles.email = null`. Phone-required, password ignored.
- `supabase/functions/send-otp/index.ts` → already phone-based; just confirm purpose `login` works for staff phones (it does, via `auth.admin.listUsers` lookup).
- Update memory `mem://auth/otp-and-hybrid-system` → "Phone-only auth. Email is internal placeholder only."

### Things explicitly left alone
- Notification emails (loan approval, repayment receipt) keep going to whichever email is on file as a profile contact, but profiles whose only email is synthetic skip the email channel and only send SMS.

---

## Part 2 — Custom Loan Product builder

### Who can use it
Both **admin** and **super_admin** roles. Loan officers stay read-only on the existing `/admin/loan-products` list.

### Where it lives
`/admin/loan-products` already exists as `AdminLoanProducts.tsx` (read-only table). I'll extend it:
- Add a **"+ New Loan Product"** button (top-right) gated by `has_permission(uid, 'loan_products', 'manage')`.
- Add `/admin/loan-products/new` and `/admin/loan-products/:id/edit` routes rendering a new `LoanProductBuilder.tsx`.
- Edit buttons appear inline on each existing product row.

### Builder structure (full builder, tabbed)
The form covers everything `loan_products` already supports. Tabs:

1. **Basics** — name, product_code (auto-uppercased, unique), description, is_active toggle.
2. **Amounts & Term** — min_amount, max_amount, min_term, max_term, term_unit (days/weeks/months), repayment_frequency, installment_structure.
3. **Pricing** — interest_rate, interest_type (flat / reducing), interest_period, processing_fee_percent, platform_fee_percent + type, vat_percent, insurance_percent, late_payment_penalty_percent, penalty_frequency, early_repayment_allowed + fee, legal_fee_percent + deduction_mode, enforcement_fee_percent.
4. **Eligibility** — min_age, max_age, min_salary, min_credit_score, employment_types (multi-select), eligible_locations (multi-select Zambian provinces/cities), max_dti_ratio, max_salary_percent, max_concurrent_loans.
5. **Risk & Checks** — crb_check_required, crb_auto_approve_score, crb_manual_review_score, crb_auto_decline_score, blacklist_check_required, guarantee_required + fee + provider, mou_required.
6. **Documents** — multi-row "Required Document" editor (label, category, mandatory yes/no). Stored as `required_documents` JSONB.
7. **Operations** — auto_disbursement, partial_disbursement, grace_period_days, default_threshold_days, legal_escalation_days, channels (multi), repayment_methods (multi), digital_signature_required, contract_template_url.

Each tab uses zod validation. Save = single `INSERT`/`UPDATE` to `public.loan_products` via SDK (RLS already allows admins).

### Auto-generated House for every product
Today the seven Houses are hard-coded in `src/config/loanProductModules.ts`. To make new products plug in automatically:

- New table `public.product_houses` (already implied by `product_house_borrowers`) — but we don't actually need a new table; the source of truth becomes `loan_products` itself.
- Refactor `loanProductModules.ts` from a static map to a runtime hook `useLoanProductModules()` that fetches active products and returns a list `{ code, name, description, icon, termUnit, defaultTermValue, basePath: '/admin/houses/<code>' }`.
- `AdminHousesIndex.tsx` reads from that hook → every new product shows up as a card automatically.
- House routes (`HouseDashboardPage`, `HouseBorrowersPage`, `HouseLoansPage`, `HouseDisbursementsPage`, `HouseCollectionsPage`, `HouseReportsPage`, `HouseReviewPage`, `HouseLoanCreatePage`, `HouseLoanDetailPage`, `HouseLoanEditPage`) are already generic on `:productCode`. I'll relax the strict `LoanProductCode` union to `string` and validate against the runtime product list instead of the hard-coded map. Marketeer, Payday, etc. keep their special calculation/validation paths via a tiny `productHandlers` registry keyed on `product_code`.
- `enforce_house_product_rules()` trigger keeps enforcing custom rules for the seven legacy codes; new custom products fall through to a generic validator that just checks `min_amount`/`max_amount` and `min_term`/`max_term`.

### Permissions
Migration adds `loan_products.manage` permission, granted to `admin` and `super_admin` roles. RLS on `loan_products` already allows admins to write; we just gate the UI via `has_permission`.

---

## Technical details

### New / changed files (high-level)

```
auth/
├─ src/pages/Auth.tsx                          (rewrite — phone-only)
├─ src/pages/AdminLogin.tsx                    (phone-only)
├─ src/components/auth/PhoneAuthForm.tsx       (drop email/password step)
├─ src/hooks/useAuth.tsx                       (drop email methods)
├─ supabase/functions/verify-otp/index.ts      (signup w/o email/password)
├─ DELETE  src/pages/ResetPassword.tsx, ForgotPassword UI

products/
├─ src/pages/admin/AdminLoanProducts.tsx       (+ create/edit buttons)
├─ src/pages/admin/LoanProductBuilder.tsx      (NEW — tabbed form)
├─ src/services/repositories/loanProductsRepository.ts  (+ upsert/delete)
├─ src/config/loanProductModules.ts            (refactor → hook)
├─ src/hooks/useLoanProductModules.ts          (NEW)
├─ src/pages/admin/houses/*.tsx                (accept any product_code)
├─ src/App.tsx                                 (+ new routes)

db/
└─ supabase/migrations/<ts>_phone_auth_and_custom_products.sql
    - INSERT into public.permissions ('loan_products', 'manage')
    - INSERT into public.role_permissions for admin + super_admin
    - Update enforce_house_product_rules() to no-op for unknown codes
    - Add set_user_phone(user_id, phone) RPC (super_admin only)
```

### Rollout
1. DB migration (permissions + trigger update).
2. Product builder + dynamic house wiring (no user-visible auth change yet).
3. Phone-only auth swap-over.
4. Smoke-test admin login on staging.

### Out of scope
- Removing the `email` column from `profiles` (kept nullable, used for notifications only when real).
- Deleting old email templates from `_shared/email-templates` (harmless, unused).
- Migrating already-issued passwords (nothing to do — they simply stop being used).

---

Approve and I'll execute in the order above.
