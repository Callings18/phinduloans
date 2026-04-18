# Phindu LMS — RBAC Matrix

Every action listed maps to a `permissions(module, action)` row enforced by:

- `has_permission(user_id, module, action)` — DB function checked by `PermissionRoute`, RPCs, and UI guards.
- `has_role(user_id, role)` — DB function for role-only gates.

**Legend:** ✅ allowed · ❌ forbidden · ⚙️ allowed via `has_role` fallback.

## Role hierarchy (top wins)

`super_admin` ⟶ `admin` ⟶ `finance_officer` / `loan_officer` / `credit_officer` / `collections_officer` / `auditor` ⟶ `user` (borrower)

---

## Loans module

| Action (`loans.*`) | Loan Officer | Credit Officer | Finance Officer | Collections | Auditor | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `verify_documents` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `approve` | ❌ | ✅ | ✅ | ❌ | ❌ | ⚙️ | ⚙️ |
| `finance_approve` | ❌ | ❌ | ✅ | ❌ | ❌ | ⚙️ | ⚙️ |
| `edit` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `default` (mark defaulted) | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |

## Disbursements (`disbursement.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `view` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `disburse` (create) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `approve` (complete pending — debits account) | ❌ | ❌ | ✅ | ❌ | ❌ | ⚙️ | ⚙️ |
| `manage` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |

> **Server enforcement:** `complete_disbursement` RPC checks `disbursement.approve` OR `disbursement.manage` OR `admin`/`super_admin`/`finance_officer`. Client UI hides the button when `can("disbursement","approve")` is false.

## Repayments / Collections (`repayments.*`, `collections.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `repayments.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `repayments.record` (record_loan_payment RPC) | ✅ | ❌ | ✅ | ✅ | ❌ | ⚙️ | ⚙️ |
| `collections.view` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `collections.assign` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |

## Borrowers (`borrowers.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `create` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `edit` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `verify_kyc` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |

## Write-offs / Court (`writeoffs.*`, `court.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `writeoffs.view` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `writeoffs.manage` (approve/reject/recover) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `court.view` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `court.manage` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |

## Reports / Audit (`reports.*`, `audit.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `reports.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reports.export` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `audit.view` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

## HR / Payroll (`hr.*`, `payroll.*`, `expenses.*`)

| Action | LO | CO | FO | Coll | Aud | Admin | Super |
|---|---|---|---|---|---|---|---|
| `hr.view` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `payroll.view` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `payroll.run` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `expenses.view` | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `expenses.approve` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |

## Administration

| Action | Loan/Cred/Fin/Coll/Aud | Admin | Super |
|---|---|---|---|
| `settings.manage` | ❌ | ✅ | ✅ |
| `staff` view+edit (uses `settings.manage`) | ❌ | ✅ | ✅ |
| Roles & Permissions page (`adminOnly`) | ❌ | ✅ | ✅ |
| Email log (`adminOnly`) | ❌ | ✅ | ✅ |
| Loan Products edit (`adminOnly`) | ❌ | ✅ | ✅ |

## Borrower (`user`)

- Owns own `loan_applications` rows (RLS)
- Owns own `borrower_*` profile rows
- Read own `loan_repayments`
- Cannot access any `/admin/*` route (`AdminRoute` guard)

## How to verify in production

For each role, log in as a test user and navigate to the protected routes. Pages should either render normally (allowed) or redirect to `/admin` with no permission toast (forbidden).

For RPC-level checks, the easiest way is the SQL editor:

```sql
select public.has_permission('<user_uuid>', 'disbursement', 'approve');
select public.has_role('<user_uuid>', 'finance_officer');
```
