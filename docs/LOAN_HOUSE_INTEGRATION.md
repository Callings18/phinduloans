# Loan house — integration tests (Phase 1)

End-to-end RPC flow: [`tests/integration/loan-flow.full.test.ts`](../tests/integration/loan-flow.full.test.ts).

## Required environment

| Variable | Description |
|----------|-------------|
| `E2E_SUPABASE_URL` | Staging (or prod-like) project URL |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Service role — never commit |
| `E2E_STAFF_USER_ID` | Staff with `user_product_access` for target product |
| `E2E_PRODUCT_CODE` | One of the seven house codes (default `MARKETEER`) |
| `E2E_FUNDING_ACCOUNT_ID` | Optional active funding account UUID |

Prerequisites: migrations at head ([`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md)).

## Single house

```bash
E2E_SUPABASE_URL=https://xxx.supabase.co \
E2E_SUPABASE_SERVICE_ROLE_KEY=eyJ... \
E2E_STAFF_USER_ID=uuid-here \
E2E_PRODUCT_CODE=COLLATERAL \
npm run test:integration:loan-flow
```

## All seven houses

```bash
# PowerShell (set env vars first)
npm run test:integration:houses
```

Runs `scripts/run-loan-flow-all-houses.mjs`, which executes vitest once per product code. Skips entirely if `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` / `E2E_STAFF_USER_ID` are unset.

| Order | `E2E_PRODUCT_CODE` |
|-------|-------------------|
| 1 | `COLLATERAL` |
| 2 | `MARKETEER` |
| 3 | `PAYDAY_SOFT` |
| 4 | `SALARY_ADVANCE` |
| 5 | `SALARY_ADVANCE_STAFF` |
| 6 | `BUSINESS` |
| 7 | `MOTOR_VEHICLE` |

## CI suggestion

Add a workflow job with GitHub secrets mirroring the table above; matrix strategy on `E2E_PRODUCT_CODE` for nightly staging verification.
