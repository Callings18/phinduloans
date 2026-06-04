# Product acceptance checklist (per loan product)

Use this for **client demos and release sign-off**: each **active** loan product in production should pass the golden path once end-to-end.

**Loan house deep audit (2026):** Track staging/production sign-off in [`LOAN_HOUSE_AUDIT_MATRIX.md`](./LOAN_HOUSE_AUDIT_MATRIX.md). Run UAT steps from [`LOAN_HOUSE_UAT_RUNBOOK.md`](./LOAN_HOUSE_UAT_RUNBOOK.md). Apply production migrations and health SQL per [`LOAN_HOUSE_PRODUCTION_ROLLOUT.md`](./LOAN_HOUSE_PRODUCTION_ROLLOUT.md).

## Canonical `product_code` list (repo + DB)

These codes are defined or seeded in Supabase migrations (see `20260413130000_loan_products_extensions_and_phindu_catalog.sql`, `20260414131455_c914345f-4105-401a-acc5-5d34baa66170.sql`, and related patches):

| `product_code`        | Typical catalog name (migration seed) |
| --------------------- | ------------------------------------- |
| `SALARY_ADVANCE`      | Salary Advance Loan                   |
| `SALARY_ADVANCE_STAFF`| Members of staff (staff variant)      |
| `PAYDAY_SOFT`         | Payday Soft Loan                      |
| `COLLATERAL`          | Collateral Based Loan                 |
| `BUSINESS`            | Business Loan                         |
| `MOTOR_VEHICLE`       | Motor Vehicle Loan                    |
| `MARKETEER`           | Marketeer Loan                        |

**In-app house routing** is driven by `src/config/loanProductModules.ts` (seven product modules, including `SALARY_ADVANCE_STAFF`). Any `product_code` present in production but missing from that config still needs a **parity pass** (routes, guards, KPIs).

### Verify production matches this list

Run in Supabase SQL (production):

```sql
SELECT product_code, name, is_active, status
FROM public.loan_products
WHERE product_code IS NOT NULL
ORDER BY product_code;
```

Treat any **extra** `product_code` returned here as **must-add** to this document and to `loanProductModules` / access seeds as appropriate.

---

## Global prerequisites (all products)

- [ ] Migrations applied through **`20260417090000_salary_advance_staff_rules_and_access.sql`** (or current head), including house RLS, report posting, and staff product rules/access.
- [ ] Demo users have **`user_product_access`** rows for every product you are signing off (migration seeds `SALARY_ADVANCE_STAFF` for admin/super_admin when that catalog row exists).
- [ ] House permissions: `house.*` needed for create → review → disburse → collections; `house.reports_export` (and `reports.*` where used) for CSV export and **Post to Reports**.
- [ ] **Reports → House Posts** tab shows posted exports after **Export + Post** from the product house reports page.

---

## Golden path (repeat per product)

For each `product_code` below, complete with a **realistic test borrower** and **known-good** amounts/terms for that product.

- [ ] **Create**: New application from house (or approved path) for this `loan_product_id`; no unexpected validation errors.
- [ ] **Documents**: Upload / verify required docs for this product; status moves as expected.
- [ ] **Reviews**: Officer → Finance → Manager (as required for your workflow); no stage skips.
- [ ] **Approve / contract**: Loan reaches approved/contract-ready state; contract step works if applicable.
- [ ] **Disburse**: Disbursement queue shows loan; disburse succeeds when prerequisites are met.
- [ ] **Repayment**: At least one repayment or claim path works; ledger/balance looks correct.
- [ ] **Collections** (if used): Buckets/actions behave; permission denials are clear, not silent failures.
- [ ] **House reports**: Export CSV succeeds; **Post** creates an entry visible under **Admin → Reports → House Posts**.
- [ ] **Product dashboard** (if in `loanProductModules`): KPIs/widgets load without error for this product filter.

**Sign-off**

- Product: _______________________
- `product_code`: _______________________
- Date: _______________________
- Notes / defects: _______________________

---

## `SALARY_ADVANCE`

- [ ] Server rules: civil servant confirmation + employed/contract (see `enforce_house_product_rules`).
- [ ] Golden path checklist above.

---

## `SALARY_ADVANCE_STAFF`

- [ ] Dedicated house at `/admin/houses/SALARY_ADVANCE_STAFF` (see `loanProductModules`); server rules mirror salary advance (eligibility confirmation + employed/contract).
- [ ] Golden path checklist above.

---

## `PAYDAY_SOFT`

- [ ] Server rules: **Lusaka** city, **30 days** term (see `enforce_house_product_rules`).
- [ ] Home verification flags align with product config.
- [ ] Golden path checklist above.

---

## `COLLATERAL`

- [ ] Collateral / physical collection steps match product flags.
- [ ] Golden path checklist above.

---

## `BUSINESS`

- [ ] Server rules: **self_employed** or **contract** employment type.
- [ ] Golden path checklist above.

---

## `MOTOR_VEHICLE`

- [ ] Server rules: **3–24 months**, `term_unit` months.
- [ ] Golden path checklist above.

---

## `MARKETEER`

- [ ] Server rules: principal **K1,000–K10,000**, **26** collection days, local authority compliance, **≥ 6** months in business (see `enforce_house_product_rules` and marketeer migrations).
- [ ] Preview/save pricing matches disbursement terms.
- [ ] Golden path checklist above.
