# Phase 1 Smoke Tests

Use these checks after enabling `VITE_API_PHASE1_WORKFLOW=true` and running `apps/api-next`.

## Pre-req
- API running on `http://localhost:3001`
- Frontend running on `http://localhost:8080`
- Borrower and admin test users available

## Borrower flow
1. Log in as borrower.
2. Open dashboard payments.
3. Submit a payment claim with reference.
4. Expected:
   - success toast
   - row appears in borrower payment claims
   - recent loan activity shows `payment_claim_submitted`

## Admin flow
1. Log in as admin.
2. Open repayments.
3. Verify and record the pending borrower claim.
4. Expected:
   - claim leaves pending queue
   - repayment is recorded
   - `payment_claim_reviewed` event exists

## Status transition flow
1. In admin applications, transition a loan status (e.g. `under_review` -> `approved`).
2. Expected:
   - transition accepted only when valid
   - invalid transition returns clear error
   - event appears in timeline
   - `loan_status_transitions` row created

## Notifications flow
1. Submit claim and review claim.
2. Expected:
   - `notification_logs` entries inserted for borrower/admin recipients
   - borrower notification center receives new rows

## Idempotency check (review endpoint)
1. Replay `POST /api/v1/payment-claims/:id/review` with same `Idempotency-Key`.
2. Expected:
   - second request returns cached success (no duplicate side effects)

## Correlation logging check
1. Trigger claim submit and status transition.
2. Expected:
   - API logs include `[phase1]` entries with `requestId`.

## Playwright smoke automation
- Run: `npm run test:e2e:smoke`
- Optional headed run: `npm run test:e2e:headed`
- Env vars used by automation:
  - `E2E_BASE_URL` (default `http://127.0.0.1:8080`)
  - `E2E_STAFF_LOW_EMAIL`, `E2E_STAFF_LOW_PASSWORD` (low-privileged staff: settings redirect)
  - `E2E_FINANCE_EMAIL`, `E2E_FINANCE_PASSWORD` (finance flows + **houses hub** + global disbursements/repayments/reports — user must have `loans:view`, `disbursement:view`, `repayments:view`, and reports access as applicable, e.g. `finance_officer`)
  - `E2E_BORROWER_EMAIL`, `E2E_BORROWER_PASSWORD` (optional — **non-staff** borrower; asserts `/dashboard` loads after login)
  - `E2E_HOUSE_PRODUCT_CODE` (optional — e.g. `MARKETEER`; finance user must have `house:dashboard_view` for that product; asserts house dashboard KPIs load)
- Optional client monitoring (not required for smoke):
  - `VITE_SENTRY_DSN` — when set, `@sentry/react` is initialized in `src/main.tsx` and `errorHandler` forwards captured errors to Sentry.
- Notes:
  - Tests auto-skip if credentials are not provided.
  - Start the Vite dev server on the same host/port as `E2E_BASE_URL` before running Playwright locally.
  - Finance flow checks also auto-skip when no pending rows exist in the environment.
