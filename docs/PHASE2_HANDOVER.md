# Phase 2 handover — UAT, CI secrets, E2E

Phase 1 commit: `caaf6010`. This doc covers Phase 2 stabilization items.

## SQL migrations (run in order)

See [`MIGRATIONS_FOR_DEPLOY.md`](./MIGRATIONS_FOR_DEPLOY.md) for the full paste checklist. Phase 2 adds:

| Order | File | Purpose |
|------:|------|---------|
| 3 | [`supabase/migrations/20260603213000_collateral_partial_payment_repair.sql`](../supabase/migrations/20260603213000_collateral_partial_payment_repair.sql) | Collateral repair for loans **with** paid/partial installments: fix `monthly_payment`, redistribute remaining balance across untouched pending/overdue rows. |

**Manual review required** after migration (3) for any installment with `status = 'partial'` and `principal_paid > 0` — those rows are intentionally not rewritten.

Verify collateral catalog:

```sql
SELECT product_code, min_term_months, max_term_months
FROM loan_products WHERE product_code = 'COLLATERAL';
-- expect: 1, 12
```

## GitHub secrets — `integration-loan-flow` CI job

The job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs only when **all required** secrets are set.

| Secret | Required | Description |
|--------|:--------:|-------------|
| `E2E_SUPABASE_URL` | Yes | Project URL, e.g. `https://xxxx.supabase.co` |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (never commit) |
| `E2E_STAFF_USER_ID` | Yes | UUID of a staff user with loan_officer/admin role and product access |
| `E2E_PRODUCT_CODE` | No | Default `MARKETEER` if omitted |
| `E2E_FUNDING_ACCOUNT_ID` | No | UUID of active funding account; test picks one if omitted |

Add under **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

Staff user must have permissions for: product lookup, `transition_loan_status`, `complete_disbursement`, `record_loan_payment` (see `tests/integration/loan-flow.full.test.ts`).

## Run E2E integration test locally

From repo root (PowerShell example):

```powershell
$env:E2E_SUPABASE_URL = "https://your-project.supabase.co"
$env:E2E_SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
$env:E2E_STAFF_USER_ID = "uuid-of-staff-user"
$env:E2E_PRODUCT_CODE = "MARKETEER"   # optional
$env:E2E_FUNDING_ACCOUNT_ID = "uuid"  # optional
npm run test:integration:loan-flow
```

Without env vars the suite **skips** (7 tests). Unit tests: `npm test`. Typecheck: `npm run typecheck`.

## Per-house UAT checklist

For each product house, sign off **Create → Edit → Review → Disburse → Collect** using `/admin/houses/{PRODUCT_CODE}/…`.

Mark each step **Pass / Fail / N/A** and note the loan ID.

### COLLATERAL (`/admin/houses/COLLATERAL`)

| Step | Route / action | Expected |
|------|----------------|----------|
| Create | `…/loans/create` | Term 1–12 months accepted; co-borrower + collateral docs upload; status `pending` |
| Edit | `…/loans/{id}/edit` | Term/amount/docs update before disbursement |
| Review | `…/review` | Verify docs → Finance → Approve (or reject with reason) |
| Disburse | `…/disbursements` | Pick funding account → Disburse now → schedule generated |
| Collect | `…/collections` or loan detail | Record payment; receipt; outstanding decreases |

### PAYDAY_SOFT

| Step | Notes |
|------|-------|
| Create | Lusaka only; exactly 30 days |
| Edit | Pre-disbursement only |
| Review | Standard 3-stage |
| Disburse | Single repayment row typical |
| Collect | Full or partial payment on due installment |

### MARKETEER

| Step | Notes |
|------|-------|
| Create | Local authority compliance + 6+ months business; 26-day term |
| Edit | Pre-disbursement |
| Review | Standard |
| Disburse | Daily collection schedule |
| Collect | Use Collections page or daily tracker on dashboard |

### SALARY_ADVANCE

| Step | Notes |
|------|-------|
| Create | Civil servant confirmed; employed/contract |
| Edit | Pre-disbursement |
| Review | Standard |
| Disburse | Monthly schedule |
| Collect | Standard repayment recording |

### BUSINESS

| Step | Notes |
|------|-------|
| Create | Self-employed or contract borrower |
| Edit | Pre-disbursement |
| Review | Standard |
| Disburse | Term per product config |
| Collect | Standard |

### MOTOR_VEHICLE

| Step | Notes |
|------|-------|
| Create | Term 3–24 months |
| Edit | Pre-disbursement |
| Review | Standard |
| Disburse | Vehicle docs visible on loan detail |
| Collect | Standard |

### Cross-cutting checks (all houses)

- [ ] House nav tabs load (Dashboard, Borrowers, Loans, Review, Disbursements, Collections, Reports)
- [ ] Loan detail shows `LoanDocumentsCard` with upload/view
- [ ] RPC failures show toast (not silent console-only)
- [ ] CSV export on Loans page works
- [ ] Reports page export/download works

## Supabase CLI

Local CLI is **not linked** in dev environments without `supabase link`. Use SQL Editor paste per `MIGRATIONS_FOR_DEPLOY.md`, or after linking:

```bash
npx supabase login   # interactive — required once
npx supabase link --project-ref YOUR_REF
npx supabase db push
```

## Remaining Phase 3 items

| Area | Work |
|------|------|
| HR / payroll | Parallel-run validation; statutory YTD exports |
| Notifications | Production channel verification (SMS/email/WhatsApp) |
| Mobile | Release checklist for Capacitor builds |
| Admin consolidation | Reduce duplicate paths (`AdminApplications` vs house flows) |
| Full bug sweep | Per-house edge cases after UAT sign-off |
| Legacy LMS | Explicit integration adapter if external sync required |
