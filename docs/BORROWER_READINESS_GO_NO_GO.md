# Borrower side — go / no-go readiness (engineering)

**Date:** Generated with borrower hardening work (Playwright + UI hooks + docs).  
**Scope:** Borrower web dashboard and core self-service flows.

## Verdict

| Gate | Status |
|------|--------|
| **Go for controlled UAT / pilot** | **Yes** — dashboard, tabs, KYC workspace, profile edits, and payment claim UI are implemented; smoke and critical-path automation exist behind env flags. |
| **Go for “fully production-ready” without caveats** | **No** — depends on real Supabase config, seeded borrower data for payment-claim E2E, and completion of launch checklist items outside this repo. |

## What was added or tightened

1. **Playwright borrower critical path** — [`tests/e2e/borrower-critical.spec.ts`](../tests/e2e/borrower-critical.spec.ts)  
   - Sign-in → dashboard welcome (`data-testid="borrower-dashboard-welcome"`).  
   - Deep link `/dashboard?tab=profile&kyc=documents` → KYC sheet visible.  
   - Profile: invalid name blocks save; valid name saves (toast).  
   - Payment claim: opens dialog and submits **only if** a pending repayment row exists (otherwise skipped).

2. **Stable UI hooks** — `data-testid` on borrower KYC sheet, profile tab controls, payment claim dialog, and “I’ve paid” actions for reliable selectors.

3. **Install / PDF notes** — [`docs/DEV_DEPENDENCIES.md`](./DEV_DEPENDENCIES.md) documents `jspdf` / `jspdf-autotable` and recommends `npm ci`.

## How to validate before sign-off

```sh
npm ci
npm run build
npm run test:e2e:smoke
# With E2E_BORROWER_EMAIL / E2E_BORROWER_PASSWORD and a borrower that has at least one pending repayment:
npm run test:e2e:borrower
```

Set `E2E_BASE_URL` if the app is not on the Playwright default (`http://127.0.0.1:8080`).

## Residual risks (explicit)

- **Payment claim E2E** skips when the test borrower has no pending installments — not a product failure; fix with seed data or a dedicated fixture user.
- **Auth / rate limits / Edge Functions** (e.g. welcome notification 401) remain environment-dependent; see existing Supabase handoff docs.
- **Full launch** still requires items in [`PRODUCTION_LAUNCH_CHECKLIST.md`](./PRODUCTION_LAUNCH_CHECKLIST.md) (migrations, providers, backups, etc.).

## Recommendation

Proceed with **client UAT** using [`CLIENT_UAT_CHECKLIST_10.md`](./CLIENT_UAT_CHECKLIST_10.md), run borrower Playwright where creds exist, and track failures in the backlog until pilot sign-off.

## Last automated validation (repo)

- `npm run build` — pass  
- `npm run test` (Vitest) — pass (31 tests)  
- `npm run test:e2e:borrower` — **4 skipped** when `E2E_BORROWER_*` is unset; with creds + dev server + seeded borrower data, expect executed passes or targeted skips (payment claim when no pending repayment).
