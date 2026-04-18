# Phindu LMS — Launch QA Test Sheet

**Purpose:** end-to-end manual UAT covering every loan product, every role, and every status transition. Tester signs each row before launch.

**How to use:**
1. Tester column = initials.
2. Result = ✅ pass / ❌ fail / ⚠️ partial. Any ❌ blocks launch.
3. Notes = bug ID, screenshot link, or comment.

---

## Roles required for testing

| Role | Test account | Purpose |
|---|---|---|
| Borrower | borrower-uat@example.com | Apply / view status |
| Loan Officer | lo-uat@phindu.com | Review docs, recommend |
| Finance Officer | fo-uat@phindu.com | Approve, disburse |
| Admin | admin-uat@phindu.com | Full lifecycle |
| Super Admin | superadmin@phindu.com | Roles, settings, audit |

---

## A. Per-product end-to-end flow

Repeat the 12 steps below for **each** product.

| # | Step | Expected | Tester | Result | Notes |
|---|---|---|---|---|---|
| 1 | Borrower signs up via OTP | Lands on dashboard, no redirect loop |  |  |  |
| 2 | Borrower completes KYC (NRC front/back/selfie) | KYC widget shows 3/3 verified after admin verification |  |  |  |
| 3 | Borrower submits application for the product | Status = **Submitted**, appears in admin Applications |  |  |  |
| 4 | Borrower uploads payslip + bank statement | Docs visible inline in admin Documents tab; payslip password visible to admin |  |  |  |
| 5 | Loan Officer reviews and recommends | Status moves to **Under Review** (or stays Submitted, then approved) |  |  |  |
| 6 | Admin approves | Status = **Approved**; borrower receives SMS + email |  |  |  |
| 7 | Contract auto-generated and uploaded to storage | PDF accessible via `signed_contract_url` |  |  |  |
| 8 | Borrower signs contract (in-app pad or upload) | `borrower_signed = true`; status moves toward **Awaiting Disbursement** |  |  |  |
| 9 | Admin/Finance creates disbursement, picks source account | Disbursement row created **pending**; account balance unchanged |  |  |  |
| 10 | Admin clicks **Complete** with source account selected | RPC `complete_disbursement` runs: balance debited, ledger row created, loan → **Disbursed**, schedule generated |  |  |  |
| 11 | First repayment recorded via record_loan_payment | Receipt generated, account credited, repayment status paid |  |  |  |
| 12 | All installments paid | Loan auto-transitions to **Completed**; clearance message sent |  |  |  |

### Products to run through (one row per product per launch)

| Product | Term unit | Interest type | Special checks |
|---|---|---|---|
| Salary Advance | months | flat | one-month term, single bullet repayment OK |
| Payday Loan | days | flat (one-time) | full payoff at term end |
| Personal Loan | months | reducing | amortization correct |
| Business Loan – Short Term | months | flat (one-time) | total interest = principal × rate (not × months) |
| Collateral Loan | months | reducing | up to 3 collateral images persist |
| Marketeer (daily) | days | daily 20% pricing tier | weekend skipping, K20 daily installment |
| PMIC payroll-deduction | months | flat | enrollment + reconciliation flow |
| Top-up | months | inherits parent | parent loan linkage in chain view |

---

## B. Status sync verification (borrower vs admin vs DB)

For one application, after each transition open three windows:
borrower dashboard / admin Applications / Supabase `loan_applications.status`.
**All three must show the same canonical label** (Submitted, Under Review, Approved, Contract Signing, Awaiting Disbursement, Disbursed, Active, Completed, Rejected, Defaulted).

| Transition | Borrower label | Admin label | DB enum | Result |
|---|---|---|---|---|
| Submit | Submitted | Submitted | `pending` |  |
| Approve | Approved | Approved | `approved` |  |
| Contract sent | Contract Signing | Contract Signing | `contract_signing` |  |
| Both signed | Awaiting Disbursement | Awaiting Disbursement | `awaiting_disbursement` |  |
| Disbursed | Disbursed | Disbursed | `disbursed` |  |
| First payment | Active | Active | `active` |  |
| Last payment | Completed | Completed | `completed` |  |

---

## C. Financial calculation spot-checks

For each product, enter K10,000 / 6 months in the admin loan calculator and confirm:

| Check | Expected (Salary Advance flat 5%/mo) | Actual | Result |
|---|---|---|---|
| Total interest | K3,000 (10,000 × 0.05 × 6) |  |  |
| Total repayment | K13,000 |  |  |
| Monthly payment | K2,166.67 |  |  |
| Disbursement amount (after 2% processing + 16% VAT on fees) | ~K9,768 |  |  |
| Late penalty after 1 month overdue (5% on principal) | K500 |  |  |
| Early settlement after 3 months (5% of remaining principal) | computed in `calculate_early_settlement` |  |  |

Repeat with: K5,000 / 30 days (Marketeer) — expect K6,000 total, K20/day × 300 → adjusted to weekday-only schedule.

---

## D. Disbursement balance enforcement

| Scenario | Expected | Result |
|---|---|---|
| Source account has K100k, disburse K50k | Success; account drops to K50k |  |
| Source account has K10k, disburse K50k | Toast: "Insufficient funds in {Account}. Available: K10,000.00, Required: K50,000.00". Status stays pending. Balance unchanged. |  |
| Source account is_active = false | Toast: "Account ... is inactive" |  |
| Two admins click Complete simultaneously | Only one succeeds (row lock); the other gets "Disbursement is completed; only pending can be completed" |  |
| Audit log row exists with action=DISBURSEMENT_COMPLETED | Yes |  |

---

## E. RBAC enforcement (see also `RBAC_MATRIX.md`)

| Role | Action attempted | Expected | Result |
|---|---|---|---|
| Loan Officer | Click "Complete" on disbursement | Hidden or rejected with permission error |  |
| Loan Officer | Edit loan amount on approved loan | Forbidden |  |
| Finance Officer | Approve loan | Allowed (has finance_approve) |  |
| Finance Officer | Edit loan product | Forbidden |  |
| Collections Officer | Record payment | Allowed |  |
| Collections Officer | Approve write-off | Forbidden |  |
| Admin | Disburse | Allowed |  |
| Admin | Manage roles | Forbidden (super_admin only) |  |
| Super Admin | Everything | Allowed |  |
| Borrower | Open `/admin` | Redirected to `/dashboard` |  |

---

## F. Notification dry-run

Trigger each event with a real test borrower phone + email. Confirm receipt within 2 minutes.

| Event | SMS | Email | WhatsApp | In-app | Result |
|---|---|---|---|---|---|
| Application submitted | ✓ | ✓ | – | ✓ |  |
| Loan approved | ✓ | ✓ | – | ✓ |  |
| Contract ready | ✓ | ✓ | optional | ✓ |  |
| Disbursed | ✓ | ✓ | – | ✓ |  |
| Payment received | ✓ | ✓ | – | ✓ |  |
| Payment reminder (T-3 days) | ✓ | ✓ | – | – |  |
| Overdue | ✓ | ✓ | – | ✓ |  |
| Loan completed | ✓ | ✓ | – | ✓ |  |

---

## G. Edge cases

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Borrower with active loan tries to apply again | Blocked or warned about duplicate |  |
| 2 | Disburse without source account | Error: "Please select a source account" |  |
| 3 | Disburse loan whose contract not signed | Blocked with clear message |  |
| 4 | KYC < 3/3 verified docs | Disbursement blocked |  |
| 5 | Default a loan | Reason required (>= 3 chars), audit logged |  |
| 6 | Top-up an active loan | Parent loan linkage shown in chain view |  |
| 7 | Restructure: change rate or term | Schedule regenerated, audit shows old/new |  |
| 8 | Marketeer schedule | Skips Sat/Sun |  |

---

## Sign-off

| Name | Role | Date | Signature |
|---|---|---|---|
|  | UAT Lead |  |  |
|  | Client representative |  |  |
|  | Phindu CTO/PM |  |  |

**Launch is approved only when no ❌ remains in sections A–E.**
