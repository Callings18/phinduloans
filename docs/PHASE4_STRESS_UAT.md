# Phase 4 — Stress Test & UAT Execution

**Date:** 2026-07-08  
**Prerequisite:** Phase 3 code audit complete ([PHASE3_WORKFLOW_AUDIT.md](./PHASE3_WORKFLOW_AUDIT.md), commit `462db645` on `main`)  
**Aligned with:** [LAUNCH_MATRIX_UAT.md](./LAUNCH_MATRIX_UAT.md) · [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) · [STAGING_SEED_UAT.md](./STAGING_SEED_UAT.md) · [RLS_UI_MATRIX.md](./RLS_UI_MATRIX.md)

---

## 1. Objectives and scope

| Phase | Proves | Does **not** prove |
|-------|--------|-------------------|
| **Phase 3** | Code paths exist; borrower P0 bugs fixed; RPC/RLS traced in repo | Live behaviour under load; ops sign-off |
| **Phase 4** | Staging volume + concurrent usage; formal UAT scripts executed; staging PASS gate for prod | Phase 5 perf cleanup; Phase 6 AI ops |

**Phase 4 exit criteria**

1. Staging seeded to ~**100 borrowers** + ~**20 staff** (scripted or manual).
2. Top-10 UAT scripts executed with pass/fail recorded.
3. Read-only stress smoke (or k6) shows acceptable latency/error rate on health + loan-products.
4. Automated checks green (typecheck; unit/integration/E2E where env allows).
5. **Staging sign-off** signed before production deploy.

---

## 2. Staging prerequisites

### 2.1 Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | Yes | Staging project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon key for borrower/staff web |
| `VITE_API_URL` | Recommended | Deployed `apps/api-next` base URL |
| `VITE_API_PHASE1_WORKFLOW` | Recommended `true` | Enables payment-claim review API — match staging to avoid "claims stuck" |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed/integration only | Never expose to client; seed script only |

**Playwright (optional automation)**

| Variable | Purpose |
|----------|---------|
| `E2E_BASE_URL` | Borrower app URL (default dev: `http://127.0.0.1:8081`; staff smoke uses `8080`) |
| `E2E_BORROWER_EMAIL` / `E2E_BORROWER_PASSWORD` | Non-staff borrower |
| `E2E_FINANCE_EMAIL` / `E2E_FINANCE_PASSWORD` | Finance staff smoke |
| `E2E_STAFF_LOW_EMAIL` / `E2E_STAFF_LOW_PASSWORD` | Low-privilege staff |
| `E2E_HOUSE_PRODUCT_CODE` | e.g. `MARKETEER` |
| `E2E_SEEDED_EXPENSE_VENDOR` | `PHINDU_SEED_EXPENSE_UAT` after [smoke-seed-expense.sql](./smoke-seed-expense.sql) |

**Integration loan-flow**

| Variable | Purpose |
|----------|---------|
| `E2E_SUPABASE_URL` | Same as staging URL |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | Service role |
| `E2E_STAFF_USER_ID` | Staff UUID with full loan flow perms |
| `E2E_PRODUCT_CODE` | Optional per-house |

### 2.2 Migrations (minimum)

Apply through at least:

- `20260604160000_restore_house_product_enforce_rules.sql` — house product trigger
- `20260410120000_restore_transition_loan_status_full.sql` — workflow RPC
- `20260610212831_*` — `record_loan_payment`
- All migrations on `main` through Phase 3 handover

See [MIGRATIONS_FOR_DEPLOY.md](./MIGRATIONS_FOR_DEPLOY.md) for full list.

### 2.3 Test accounts

| Persona | How to obtain | Example after seed |
|---------|---------------|-------------------|
| Borrower (non-staff) | Seed script or manual signup | `uat-borrower-0001@phindu-staging.test` |
| Finance officer | Seed script role `finance_officer` | `uat-staff-02@phindu-staging.test` |
| Loan officer | Seed script | `uat-staff-01@phindu-staging.test` |
| House staff | `user_product_access` for target `product_code` | Granted to all seeded staff |
| Golden-path staff | Existing `E2E_STAFF_USER_ID` for integration | Your staging admin |

Default seed password: `PhinduUat!2026` (change on prod-like envs).

### 2.4 Seed staging data

```bash
# Staging only — requires explicit confirm
STAGING_SEED_CONFIRM=1 \
SUPABASE_URL=https://YOUR-STAGING.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node scripts/seed-staging-uat.mjs
```

Optional: `SEED_BORROWER_COUNT=100` `SEED_STAFF_COUNT=20` `SEED_FORCE=1`  
Also run [smoke-seed-expense.sql](./smoke-seed-expense.sql) for deterministic expense smoke.

Idempotent: skips if `system_settings.phase4_uat_seed` exists unless `SEED_FORCE=1`.  
**Never** run against production without `STAGING_SEED_ALLOW_PROD=1` and written approval.

---

## 3. UAT execution playbook (Phase 3 top-10 → scripts)

Execute on **staging**. Record **Pass / Fail / Blocked** and notes. Tester initials + date per row.

### UAT-01 — Borrower apply → submit (all houses)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Log in as borrower; open `/dashboard?tab=apply` | Apply form loads; products listed | ☐ | ☐ | |
| 2 | Select **SALARY_ADVANCE**; complete required fields; submit | No DB trigger error; status `pending` | ☐ | ☐ | |
| 3 | Repeat for **PAYDAY_SOFT** | Submit succeeds; `term_unit` = days | ☐ | ☐ | |
| 4 | Repeat for **MARKETEER** | Marketeer JSON fields persisted | ☐ | ☐ | |
| 5 | Spot-check **COLLATERAL** or **MOTOR_VEHICLE** | Multi-borrower / vehicle docs path OK | ☐ | ☐ | |

**Role:** Borrower  
**Automated partial:** `npm run test:e2e:borrower` (dashboard/apply redirect); integration per house: `E2E_PRODUCT_CODE=... npm run test:integration:loan-flow`

---

### UAT-02 — KYC vault → apply without re-uploading identity

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Borrower uploads NRC to vault (`/dashboard?tab=profile&kyc=documents`) | Vault row `pending_review` | ☐ | ☐ | |
| 2 | Start new application; submit | Vault docs linked to `application_documents` | ☐ | ☐ | |
| 3 | Staff opens app → Document Verification tab | Identity docs visible | ☐ | ☐ | |

**Roles:** Borrower + Loan officer / house staff

---

### UAT-03 — Full disbursement (finance, house page)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Approve application through house review to `approved` | Status chain correct | ☐ | ☐ | |
| 2 | Finance: `/admin/houses/:code/disbursements` → complete disbursement | `disbursements` row; account debited | ☐ | ☐ | |
| 3 | Verify loan `active`; `loan_repayments` rows exist | Schedule count matches term | ☐ | ☐ | |

**Roles:** Loan officer + Finance

---

### UAT-04 — Record repayment (house collections)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Open active loan on house collections | Balance and schedule visible | ☐ | ☐ | |
| 2 | Record payment via `record_loan_payment` path | Principal/penalty allocated; balance reduced | ☐ | ☐ | |
| 3 | Pay until complete | Loan status `completed` | ☐ | ☐ | |

**Roles:** Finance or collections staff

---

### UAT-05 — Borrower payment claim (Phase1 API on)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Confirm `VITE_API_PHASE1_WORKFLOW=true` on staging | API health OK | ☐ | ☐ | |
| 2 | Borrower submits claim on pending repayment | Success toast; claim `pending_review` | ☐ | ☐ | |
| 3 | Staff approves via admin API/UI | Balance updates; claim approved | ☐ | ☐ | |

**Roles:** Borrower + Finance  
**Automated:** `borrower-critical.spec.ts` payment claim tests when pending repayment exists

---

### UAT-06 — Contract flow (generate → sign → disburse)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Staff generates contract | `contract_url` set | ☐ | ☐ | |
| 2 | Borrower signs in `ContractSigningWidget` | `borrower_signed` true | ☐ | ☐ | |
| 3 | Admin signs; disburse | Status reaches `active` after disburse | ☐ | ☐ | |

**Roles:** Borrower + Loan officer + Finance

---

### UAT-07 — Document re-upload after rejection

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Staff rejects a document with reason | Borrower sees rejection | ☐ | ☐ | |
| 2 | Borrower re-uploads via `DocumentChecklist` | New row INSERT; status `pending_review` | ☐ | ☐ | |
| 3 | Staff verifies new doc | No RLS error on borrower side | ☐ | ☐ | |

**Roles:** Borrower + Loan officer

---

### UAT-08 — Disbursement as loan_officer (global vs house)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Loan officer: `/admin/disbursements` → attempt disburse | UI matches RLS (allow or clear deny) | ☐ | ☐ | |
| 2 | Same user on house disbursements page | Consistent with RPC permissions | ☐ | ☐ | |
| 3 | Document any mismatch | Logged for Phase 5 if GAP | ☐ | ☐ | |

**Roles:** Loan officer (not finance)

---

### UAT-09 — Early settlement (house vs legacy modal)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | House collections: early settlement on active loan | Balance zero; loan closed | ☐ | ☐ | |
| 2 | Legacy `LoanDetailsModal` settlement (if still used) | Compare final balance — note divergence | ☐ | ☐ | |
| 3 | Record which path is canonical for prod | Decision documented | ☐ | ☐ | |

**Roles:** Finance + Admin

---

### UAT-10 — Status realtime (borrower dashboard)

| Step | Action | Expected result | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 1 | Borrower on `/dashboard` (loans tab) | Current status shown | ☐ | ☐ | |
| 2 | Staff approves same application (second browser) | Borrower UI updates without manual refresh | ☐ | ☐ | |
| 3 | Toast/notification appears once | No duplicate spam | ☐ | ☐ | |

**Roles:** Borrower + Loan officer

---

## 4. Roles matrix (who runs which UAT)

| UAT # | Borrower | Loan officer / house | Finance | Admin |
|-------|:--------:|:--------------------:|:-------:|:-----:|
| 01 Apply all houses | ✓ | — | — | — |
| 02 KYC vault | ✓ | ✓ | — | ✓ |
| 03 Disbursement | — | ✓ | ✓ | ✓ |
| 04 Repayment | — | ✓ | ✓ | ✓ |
| 05 Payment claim | ✓ | — | ✓ | ✓ |
| 06 Contract | ✓ | ✓ | ✓ | ✓ |
| 07 Doc re-upload | ✓ | ✓ | — | ✓ |
| 08 Disburse RLS | — | ✓ | — | ✓ |
| 09 Settlement | — | — | ✓ | ✓ |
| 10 Realtime | ✓ | ✓ | — | — |

---

## 5. Stress test plan

### 5.1 Volume targets

| Entity | Target | Method |
|--------|--------|--------|
| Borrower profiles | ~100 | `scripts/seed-staging-uat.mjs` |
| Staff users | ~20 | Same script (rotating roles) |
| Concurrent applies | 10–20 | Manual or scripted (integration test creates 1; scale with parallel browsers) |
| Concurrent doc uploads | 5–10 | Borrowers upload to vault in parallel |
| Concurrent payment claims | 5–10 | Requires active loans + Phase1 API |
| Read-only API load | 200+ req | `scripts/stress-readonly-smoke.mjs` |

### 5.2 Read-only smoke (built-in)

```bash
STRESS_API_URL=https://your-api-staging.example.com \
STRESS_CONCURRENCY=20 \
STRESS_TOTAL_REQUESTS=200 \
node scripts/stress-readonly-smoke.mjs
```

**Pass criteria (staging):** ≥99% HTTP 2xx; p95 latency &lt; 3000 ms on health; p95 &lt; 5000 ms on loan-products.

### 5.3 Optional k6 (heavier load)

If you need sustained load (e.g. 50 VUs × 5 min), install [k6](https://k6.io/) and run:

```javascript
// scripts/k6-readonly.example.js — copy and adjust BASE_URL
import http from "k6/http";
import { check, sleep } from "k6";
export const options = { vus: 30, duration: "3m" };
const BASE = __ENV.STRESS_API_URL || "http://localhost:3001";
export default function () {
  const r1 = http.get(`${BASE}/api/v1/health`);
  check(r1, { "health 200": (r) => r.status === 200 });
  const r2 = http.get(`${BASE}/api/v1/loan-products`);
  check(r2, { "products 200": (r) => r.status === 200 });
  sleep(0.5);
}
```

```bash
k6 run -e STRESS_API_URL=https://api-staging.example.com scripts/k6-readonly.example.js
```

**Out of scope for Phase 4:** write-heavy load (disbursements/payments) — run only on disposable staging with DB snapshot rollback.

---

## 6. Automation commands

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | TS clean staff + borrower |
| `npm run test` | Vitest unit (root config) |
| `npm run test:integration:loan-flow` | Full RPC loan flow (needs E2E_* secrets) |
| `npm run test:e2e:smoke` | Staff/finance smoke |
| `npm run test:e2e:borrower` | Borrower critical path |
| `npx playwright test tests/e2e/phase4-borrower-apply.spec.ts` | Phase 4 apply + tabs |
| `npm run seed:staging-uat` | Staging seed (see §2.4) |
| `npm run stress:readonly` | Read-only API load smoke |

---

## 7. Sign-off (staging PASS required for prod)

| Field | Value |
|-------|-------|
| Environment | Staging ☐ / Production ☐ |
| Build / commit | |
| Migrations through | `20260604160000` minimum ☐ |
| Seed completed (~100 / ~20) | ☐ |
| UAT 01–10 all PASS or accepted waivers | ☐ |
| Stress smoke PASS | ☐ |
| `VITE_API_PHASE1_WORKFLOW` verified | ☐ |
| Known GAPs from Phase 3 documented | ☐ |

**Approver name / role / date:** _________________________

**Production deploy authorized:** ☐ Yes ☐ No — staging UAT incomplete

---

## Appendix A — Local automated run results (Phase 4 authoring)

Recorded during Phase 4 artifact creation on **2026-07-08** (local workspace; E2E env typically absent).

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | staff-web + borrower-mobile |
| `npm run test` | **SKIP (7)** | integration loan-flow — no `E2E_SUPABASE_*` |
| `npm run test:e2e:borrower` | **SKIP (5)** | no `E2E_BORROWER_*`; no dev server required (skips before navigation) |
| `npm run test:e2e:phase4` | **SKIP (4)** | no dev server at `E2E_BASE_URL` (default `8081`) |
| `node scripts/stress-readonly-smoke.mjs` | **NOT RUN** | requires running api-next on `STRESS_API_URL` |
| `node scripts/seed-staging-uat.mjs` | **NOT RUN** | requires staging credentials + `STAGING_SEED_CONFIRM=1` |

_Update this appendix after staging execution with real pass/fail counts._

---

## Appendix B — Client checklist (run on staging)

1. ☐ Apply all Supabase migrations through Phase 3 on staging.
2. ☐ Set env vars (§2.1); deploy staff-web + borrower-mobile + api-next.
3. ☐ Run seed script (§2.4) + expense seed SQL if using Playwright finance tests.
4. ☐ Run `npm run test:integration:loan-flow` per house (or `test:integration:houses`).
5. ☐ Execute UAT-01 through UAT-10; fill pass/fail columns.
6. ☐ Run `stress-readonly-smoke.mjs` against staging API.
7. ☐ Run Playwright smoke + borrower + phase4 specs with staging creds.
8. ☐ Complete sign-off §7; only then promote to production.

**Related:** [PHASE3_WORKFLOW_AUDIT.md](./PHASE3_WORKFLOW_AUDIT.md) · [PHASE3_HANDOVER.md](./PHASE3_HANDOVER.md) · [CLIENT_UAT_CHECKLIST_10.md](./CLIENT_UAT_CHECKLIST_10.md)
