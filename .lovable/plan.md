# Fix client-reported gaps (Marketeer + penalties)

Four issues from the WhatsApp thread. Scope is surgical — touch only what's broken.

## 1. "Apply Penalties" button does nothing / only 1 penalty on a 2-week-overdue loan

**Root cause** (Manase loan, K685 single penalty, ~2 weeks overdue):

- `apply_loan_penalties` RPC only iterates repayments where `status = 'pending'`. The nightly cron flips overdue repayments to `status = 'overdue'` on day +1, so the manual button finds zero rows and silently returns `0`.
- The RPC also uses a **monthly** multiplier (`CEIL(days/30) × penalty%`), while the documented business rule (and the cron) is **15 % of principal every 7 days, capped at 2 cycles**. The two logics drift.
- The cron only applies penalties when `loan.status = 'defaulted'`. If the cron hasn't yet defaulted a loan (or the loan was re-activated), no penalty ever attaches.

**Fix**

- Migration: rewrite `public.apply_loan_penalties(p_loan_id)` to:
  1. Include both `pending` and `overdue` repayments past `due_date + grace_period`.
  2. Compute `cycles_due = LEAST(2, FLOOR(days_overdue / 7))` and target penalty `= principal × 15 % × cycles_due` (configurable via `loan_products.late_payment_penalty_percent`, default 15, weekly cadence).
  3. If `cycles_due > loan_applications.penalty_count`, add the **incremental** penalty to the earliest overdue repayment's `penalty_amount`, bump `penalty_count` and `total_penalties` on the loan, and (if the loan is still `active`) flip it to `defaulted` + set `defaulted_at`.
  4. Return the **incremental** penalty (so the toast shows what was added, not the cumulative total).
- Re-grant EXECUTE to `authenticated, service_role` (keep existing role-based authorization).
- No client code change needed — `LoanDetailsModal.applyPenaltiesMutation` already calls this RPC; the toast wording stays the same.

## 2. Marketeer Reports page missing "Interest Made"

File: `src/pages/admin/houses/HouseReportsPage.tsx`

- Add a 5th summary card **Interest Made** between "Total Collected" and "Outstanding".
- Compute two values:
  - **Expected interest** = Σ `(total_repayment − loan_amount)` over disbursed/active/completed loans.
  - **Interest collected** = `totalPaid − Σ principal_paid` (collected − principal portion).
- Show "Interest collected K… / Expected K…" (collected as the headline number).
- Add both values to the CSV export rows.

## 3. Monthly performance graph missing

Same file. Add a `recharts` bar chart card (full-width below the 4-card grid) showing **collections per month** for the last 12 months:

- Derive from `repayments` where `status = 'paid'`, group by `format(paid_date, 'yyyy-MM')`, sum `principal_paid + (amount − principal_paid)` (i.e., total cash in).
- X-axis = month label (e.g., "Jan 26"), Y-axis = K amount, single bar series in `--primary`.
- Empty state: "No collections recorded yet."

`recharts` already used elsewhere in the project — no new dep.

## 4. Marketeers don't have emails — use phone numbers

Two edits:

**a. `src/pages/admin/houses/HouseBorrowersPage.tsx`** (Add Borrower dialog)

- Make **phone required**, **email optional**, when `productCode === "MARKETEER"`.
- Validation in `createMutation.mutationFn`:
  - For Marketeer: require `full_name` + `phone`; allow blank email.
  - For other houses: keep current rule (name + email required).
- Update field labels/placeholders + `required` attribute conditionally.

**b. `supabase/functions/create-borrower/index.ts`**

- Make `email` optional in the request body. Required: `full_name` + at least one of (`email`, `phone`).
- When `email` is missing but `phone` is present, synthesise a placeholder `email = "${normalizedPhone}@phone.phindu.local"` so `auth.admin.createUser` still works (auth requires a unique email). Also pass `phone` so the user can sign in by SMS OTP.
- The welcome SMS already supports phone — keep it; if email was synthetic, omit the "Login email" line and only show "Login with phone OTP".
- Update profile insert: when synthetic email, store `email = null` in `public.profiles` so the UI never shows the placeholder.

## Out of scope (will not touch this loop)

- Auto-defaulting / cron behavior (works; only the manual button + monthly-vs-weekly math is fixed).
- Borrower-side login UX changes.
- Restructuring the entire reports module (only the Marketeer page gets the new metric + chart; other houses inherit since it's the same file).

## Technical notes

- Migration file: `supabase/migrations/<timestamp>_fix_apply_loan_penalties_weekly.sql`.
- Recharts import: `import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";`
- HSL tokens only — use `hsl(var(--primary))` for bar fill.
- No new env vars, no new edge function deploys beyond `create-borrower`.
