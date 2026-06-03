# Phase 3 handover — admin consolidation, notifications, sign-off

Phase 2 commit: `fb27fbb6`. This doc covers Phase 3 practical stabilization.

## Admin path consolidation map

Use **Product Houses** (`/admin/houses`) as the canonical workflow per loan product. Legacy pages remain for cross-product oversight; banners and row links guide staff to the right house.

| Task | Canonical (preferred) | Legacy (still available) |
|------|----------------------|---------------------------|
| Create loan | `/admin/houses/{PRODUCT_CODE}/loans/create` | `/admin/applications` → Add Loan |
| Review / approve | `/admin/houses/{PRODUCT_CODE}/review` | `/admin/applications` inbox |
| Edit pending loan | `/admin/houses/{PRODUCT_CODE}/loans/{id}/edit` | Applications view dialog |
| Loan detail & docs | `/admin/houses/{PRODUCT_CODE}/loans/{id}` | `/admin/loans` portfolio modal |
| Disburse | `/admin/houses/{PRODUCT_CODE}/disbursements` | `/admin/disbursements` (global) |
| Record payment | `/admin/houses/{PRODUCT_CODE}/collections` | `/admin/repayments`, `/admin/collections` |
| Product dashboard | `/admin/houses/{PRODUCT_CODE}` | `/admin` (org-wide dashboard) |
| Cross-product inbox | — | `/admin/applications` |
| Finance oversight | — | `/admin/disbursements`, `/admin/accounts` |

**Sidebar changes (Phase 3):** Product Houses is the first item under Lending; legacy entries are labeled *(inbox)*, *(portfolio)*, or *(global)*.

**Code helpers:** `src/utils/adminHousePaths.ts`, `src/components/admin/LegacyAdminPathBanner.tsx`.

## SQL migrations (June 2026 collateral)

See [`MIGRATIONS_FOR_DEPLOY.md`](./MIGRATIONS_FOR_DEPLOY.md). Apply **in order**:

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `20260603185037_443ee6b5-5131-4ee1-9b54-a4a7e1a48593.sql` | Collateral catalog 1–12 months + `enforce_house_product_rules()` |
| 2 | `20260603204500_collateral_term_1_12_everywhere.sql` | Repair installments (no payments yet) |
| 3 | `20260603213000_collateral_partial_payment_repair.sql` | Repair partial/paid collateral installments |

**Supabase CLI:** Only attempted when project is linked (`supabase link`). Otherwise paste in Lovable SQL Editor per checklist.

## Notification channels checklist

Verify each channel in **staging/production** before go-live:

| Channel | Config / location | Sign-off |
|---------|-------------------|:--------:|
| Email (transactional) | Supabase Edge / Resend; `/admin/email-log` | [ ] |
| SMS | Provider env vars; loan status templates | [ ] |
| WhatsApp | Contract share + optional provider webhook | [ ] |
| Web Push | `push_subscriptions` table + `send-web-push` Edge Function + VAPID secrets ([README](../supabase/functions/send-web-push/README.md)) | [ ] |
| In-app toasts | Sonner on admin RPC failures (Phase 3: Applications, Loans, Disbursements) | [ ] |
| Borrower dashboard | `notificationService` / bell widget | [ ] |

**Test:** Trigger approve → disburse → payment on one house loan; confirm at least email + in-app feedback; log SMS/WhatsApp if enabled.

## Mobile release notes pointer

Capacitor builds and store release steps are **not** part of Phase 3 code changes. Use:

- [`PRODUCTION_LAUNCH_CHECKLIST.md`](./PRODUCTION_LAUNCH_CHECKLIST.md) — APK, iOS guide, tag `v1.0.0-launch`
- [`PRODUCTION_RELEASE_CHECKLIST_3DAY.md`](./PRODUCTION_RELEASE_CHECKLIST_3DAY.md) — 3-day cutover including notifications
- [`CLIENT_READINESS_BACKLOG.md`](./CLIENT_READINESS_BACKLOG.md) — P0 blockers

## GitHub secrets (integration CI)

Unchanged from Phase 2 — see [`PHASE2_HANDOVER.md`](./PHASE2_HANDOVER.md):

- `E2E_SUPABASE_URL`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_STAFF_USER_ID`
- Optional: `E2E_PRODUCT_CODE`, `E2E_FUNDING_ACCOUNT_ID`

## Phase 3 sign-off items

| Item | Owner | Status |
|------|-------|--------|
| Collateral migrations (1–3) applied on hosted DB | Ops / Lovable | [ ] |
| Per-house UAT (Phase 2 checklist) | QA / product | [ ] |
| Admin staff trained on Product Houses vs legacy pages | Ops | [ ] |
| Notification channels verified (table above) | Ops | [ ] |
| Mobile release checklist (docs above) | Mobile | [ ] |
| `integration-loan-flow` CI green with secrets | Dev | [ ] |
| HR/payroll parallel-run | Deferred post-launch | N/A |

## Tests

```bash
npm run typecheck
npm test
# Optional with env:
npm run test:integration:loan-flow
```

## Deferred (post Phase 3)

- HR/payroll parallel-run validation
- Full per-house edge-case bug sweep after UAT
- Legacy LMS external sync adapter (if required)
