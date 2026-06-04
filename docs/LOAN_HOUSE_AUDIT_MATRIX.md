# Loan house audit matrix

Sign-off grid for the seven product houses. **Do not edit the plan file** — update this document during UAT.

**Repo automation (complete):** `npm test`, `npm run typecheck`, policy alignment tests, collateral/marketeer/payday unit tests, legacy banners, rollout/UAT docs. **Staging / Prod columns** (`—`) are filled by operators using [`LOAN_HOUSE_UAT_RUNBOOK.md`](./LOAN_HOUSE_UAT_RUNBOOK.md) after migrations in [`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md).

**Legend:** `—` not tested | `P` Pass | `F` Fail | `B` Blocked | `N/A`

| Staging operator | _____________ | Date started | _____________ |
| Production operator | _____________ | Date started | _____________ |

---

## Cross-house platform (Phase 1)

| Check | Staging | Prod | Notes |
|-------|:-------:|:----:|-------|
| Migrations at head ([`LOAN_HOUSE_STAGING_BASELINE.md`](./LOAN_HOUSE_STAGING_BASELINE.md)) | — | — | |
| `npm test` + `npm run typecheck` green | P | — | Repo baseline |
| Policy alignment unit tests (`houseProductPolicyAlignment.test.ts`) | P | — | UI rules vs `houseProductPolicySpec` |
| `enforce_house_product_rules` matches spec (DB manual) | — | — | Compare latest migration |
| Integration loan-flow (per `E2E_PRODUCT_CODE`) | — | — | [`LOAN_HOUSE_INTEGRATION.md`](./LOAN_HOUSE_INTEGRATION.md); `npm run test:integration:houses` |
| Legacy banners on Applications / Loans / Disbursements / Repayments / Collections | P | — | `LegacyAdminPathBanner` on all five legacy pages |
| Duplicate-loan block + completion reconcile | P | — | Migrations `20260426232011`, `20260604100000` |

---

## Module checklist (repeat per house)

Modules: **Dash** | **Borr** | **Create** | **Edit** | **Loans** | **Detail** | **Review** | **Disb** | **Coll** | **Rpt**

### 1. COLLATERAL (`/admin/houses/COLLATERAL`)

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | `HouseDashboardPage` + product filter |
| Borr | — | — | P | `product_house_borrowers` |
| Create | — | — | P | `per_loan` locked; net receivable preview |
| Edit | — | — | P | Pre-disbursement |
| Loans | — | — | P | CSV export |
| Detail | — | — | P | Docs + schedule |
| Review | — | — | P | 3-stage |
| Disb | — | — | P | `complete_disbursement` |
| Coll | — | — | P | `record_loan_payment` |
| Rpt | — | — | P | Export + post |

**House-specific:** Term 1–12; co-borrowers; migrations `20260603185037`–`04130000`, repair `03204500`/`03213000`.

**Golden-path loan ID (staging):** _____________

---

### 2. MARKETEER

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | Daily KPIs; fees in preview |
| Borr | — | — | P | |
| Create | — | — | P | 26 days; compliance; processing fee deducted; DB term guard restored (`04160000`) |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | Daily schedule |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Golden-path loan ID:** _____________

---

### 3. PAYDAY_SOFT

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | |
| Borr | — | — | P | |
| Create | — | — | P | Lusaka + 30 days; `per_loan` interest locked (`04170000`) |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | Single installment typical |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Golden-path loan ID:** _____________

---

### 4. SALARY_ADVANCE

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | |
| Borr | — | — | P | |
| Create | — | — | P | Civil servant + 1 month |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Golden-path loan ID:** _____________

---

### 5. SALARY_ADVANCE_STAFF

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | Dedicated house route |
| Borr | — | — | P | |
| Create | — | — | P | Staff max amount in rules |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Migration:** `20260417090000_salary_advance_staff_rules_and_access.sql`

**Golden-path loan ID:** _____________

---

### 6. BUSINESS

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | |
| Borr | — | — | P | |
| Create | — | — | P | Self-employed/contract |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Golden-path loan ID:** _____________

---

### 7. MOTOR_VEHICLE

| Module | Staging | Prod | Code review | Notes |
|--------|:-------:|:----:|:-------------:|-------|
| Dash | — | — | P | |
| Borr | — | — | P | |
| Create | — | — | P | Term 3–24 months |
| Edit | — | — | P | |
| Loans | — | — | P | |
| Detail | — | — | P | |
| Review | — | — | P | |
| Disb | — | — | P | |
| Coll | — | — | P | |
| Rpt | — | — | P | |

**Golden-path loan ID:** _____________

---

## Phase 9 — Legacy & borrower

| Track | Staging | Prod | Notes |
|-------|:-------:|:----:|-------|
| Legacy Applications → house create link | P | — | `LegacyAdminPathBanner` |
| Legacy Loans / Disbursements / Repayments / Collections banners | P | — | |
| Borrower apply vs house-only products | — | — | Code map: [`LOAN_HOUSE_PHASE9_LEGACY.md`](./LOAN_HOUSE_PHASE9_LEGACY.md) |
| Notification smoke (approve → disburse → pay) | — | — | Operator UAT; [`LOAN_HOUSE_PHASE9_LEGACY.md`](./LOAN_HOUSE_PHASE9_LEGACY.md) |

---

## Defect log

| ID | House | Severity | Module | Description | Loan ID | Fix / PR |
|----|-------|----------|--------|-------------|---------|----------|
| — | — | — | — | (none open from code audit) | — | — |

---

## Sign-off

| Milestone | Owner | Date |
|-----------|-------|------|
| Staging — all houses golden path | | |
| Production migrations applied | | |
| Production — smoke per house | | |
| Client acceptance ([`PRODUCT_ACCEPTANCE_CHECKLIST.md`](./PRODUCT_ACCEPTANCE_CHECKLIST.md)) | | |
