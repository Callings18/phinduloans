# Bug triage — Phindu Loans

Use this doc during **stabilization** to track defects with clear repro steps and ownership. Group by area before fixing so regressions are easier to prevent.

## How to log an issue

1. **Title:** short, user-visible symptom (e.g. “Repayment upload fails on Safari”).
2. **Area:** one of `borrower` | `admin` | `payments` | `auth` | `integrations` | `pwa` | `other`.
3. **Severity:** `blocker` | `major` | `minor` | `cosmetic`.
4. **Environment:** URL, browser/OS, role (borrower vs staff), approximate time.
5. **Steps:** numbered, from cold start.
6. **Expected vs actual.**
7. **Screenshots / request IDs** if API involved (`[phase1]` logs when Phase 1 API is enabled).

## Known technical debt (from readiness review)

| Item | Area | Notes |
|------|------|--------|
| Error tracking not wired | integrations | [`src/utils/errorHandler.ts`](../src/utils/errorHandler.ts) — TODO for Sentry or similar. |
| Phase 1 API / migrations | integrations | Requires env flags and DB migrations applied; see [`docs/PHASE1_SMOKE_TESTS.md`](PHASE1_SMOKE_TESTS.md). |
| E2E smoke skips | other | Playwright skips without `E2E_*` credentials; see smoke doc. |
| iOS PWA / push | pwa | Test install + push on real iOS; behavior differs from Android Chrome. |

## Triage buckets (fill during sessions)

### Borrower

| ID | Title | Severity | Status | Owner |
|----|-------|----------|--------|-------|
| B- | | | open | |

### Admin / ERP

| ID | Title | Severity | Status | Owner |
|----|-------|----------|--------|-------|
| A- | | | open | |

### Payments / repayments / claims

| ID | Title | Severity | Status | Owner |
|----|-------|----------|--------|-------|
| P- | | | open | |

### Auth / session

| ID | Title | Severity | Status | Owner |
|----|-------|----------|--------|-------|
| U- | | | open | |

## Regression checklist (lightweight)

After a release candidate build:

- [ ] Borrower: login, dashboard load, start application (in **installed PWA** if install gate on).
- [ ] Admin: login, open loans list, one write action (e.g. save note or transition if allowed).
- [ ] Payments: record or view repayment path used in production.
- [ ] Auth: logout / login, password reset if used.

## Link to automated smoke

When Phase 1 workflow and credentials are available:

```bash
npm run test:e2e:smoke
```

See [`docs/PHASE1_SMOKE_TESTS.md`](PHASE1_SMOKE_TESTS.md).
