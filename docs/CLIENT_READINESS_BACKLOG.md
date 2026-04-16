# Client readiness backlog (prioritized)

Use this as the **single planning list** between “feature complete” and “client go-live.”  
**Assumption:** target **2–4 weeks** to production; client uses **LMS (loans)** plus **internal HR/payroll** for staff.

**Related:** [CLIENT_UAT_CHECKLIST_10.md](./CLIENT_UAT_CHECKLIST_10.md) (pilot smoke, 10 rows) · [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) · [ENTERPRISE_READINESS_CHECKLIST.md](./ENTERPRISE_READINESS_CHECKLIST.md) · [MIGRATIONS_FOR_DEPLOY.md](./MIGRATIONS_FOR_DEPLOY.md) · [PRODUCTION_RELEASE_CHECKLIST_3DAY.md](./PRODUCTION_RELEASE_CHECKLIST_3DAY.md)

---

## How to track in GitHub

For each item below, create an issue with the **suggested title** (copy-paste). Optional one-liner:

```bash
gh issue create --title "<title>" --body "See docs/CLIENT_READINESS_BACKLOG.md — section: <Must|Should|Nice>"
```

---

## Must (release blockers)

| # | Suggested issue title | Why | Done when |
|---|------------------------|-----|-------------|
| M1 | **Apply all Supabase migrations through HR/payroll RLS on production** | RLS and `has_permission` must exist in prod or staff will see confusing errors. | `20260411120000_hr_payroll_permissions_and_rls.sql` (and full chain) applied; smoke query as `finance_officer` works. |
| M2 | **Seed and assign roles: finance / HR / admin payroll permissions** | UI gates match DB only if `role_permissions` + user `user_roles` are correct. | At least one non–super_admin user per role tested; `get_my_permissions` matches expected screens. |
| M3 | **Payroll parallel run + accountant sign-off (one month)** | Legal/commercial risk if PAYE/NAPSA/NHIMA differ from client expectation. | Signed worksheet or email from accountant comparing app CSV + payslips to their calculator for ≥3 employees. |
| M4 | **Production env: Vite + Supabase + optional api-next** | Wrong env = wrong data or silent API fallback. | [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) environment section checked for staging then prod. |
| M5 | **RLS vs UI matrix (document gaps)** | Prevents “button enabled but save fails” support tickets. | Table: role × action (view employees, edit employee, generate payroll, approve, export CSV); each cell PASS or documented limitation. |

**Code touchpoints for M2/M5:** `src/hooks/usePermissions.ts`, `src/App.tsx`, `src/pages/admin/AdminHR.tsx`, `src/pages/admin/AdminPayroll.tsx`, `supabase/migrations/20260411120000_hr_payroll_permissions_and_rls.sql`.

---

## Should (before first paying client or parallel payroll)

| # | Suggested issue title | Why | Done when |
|---|------------------------|-----|-------------|
| S1 | **Admin UI: edit `payroll_tax_config` (effective dates, relief, PAYE mode)** | Clients change bands; developers should not edit DB by hand each year. | CRUD restricted to `payroll:manage` or super_admin; validation + read-only history or `updated_at` visible. |
| S2 | **User-visible errors when RLS denies (payroll / HR)** | Reduces “it’s broken” calls. | Toast or inline message maps common Postgres/RLS failures to “no permission” / “contact admin.” |
| S3 | **Ops runbook: payroll lifecycle + roles (1–2 pages)** | Handover and training. | PDF or `docs/` page: generate → review CSV → approve → mark paid → bank file; who holds `payroll:approve`. |
| S4 | **Extend QA checklist: payroll migration id + accountant line** | Keeps sign-off in one place. | [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md) references `20260411120000` and accountant parallel run. |
| S5 | **Smoke test: Admin Payroll happy path (manual or Playwright)** | Regression safety. | Script or checklist covers expand run → export CSV → (optional) PDF payslip. |
| S6 | **Draft payroll run: delete or void (policy + optional feature)** | Wrong month generated needs a story. | Document “contact admin to adjust DB” **or** implement safe delete for `draft` only with audit. |

**Code touchpoints for S1:** new admin route + policies on `payroll_tax_config` (already partially permission-aware in migration). **S2:** `AdminPayroll.tsx` / `AdminHR.tsx` mutation `onError` handlers.

---

## Nice (post-launch or phase 2)

| # | Suggested issue title | Why |
|---|------------------------|-----|
| N1 | **Year-to-date statutory summary per employee** | Phase 3 reporting; P9-style exports. |
| N2 | **Audit log table for tax config and payroll status changes** | Enterprise accountability. |
| N3 | **Leave approval workflow tied to unpaid leave deductions** | Plan Phase 2 HR depth. |
| N4 | **Employer levies (SDL, workers comp) in engine + config** | Only if client requires. |

---

## If the client is **loans-only** (no internal payroll)

- Demote **M3, M5 (payroll rows), S1, S3, S5, S6** to *out of scope* or *future phase*.
- Keep **M1/M2** only if they still use `employees` / staff RBAC for LMS.
- Confirm **sidebar** and routes hide HR/Payroll for roles that should not see them (`adminSidebarConfig.ts`, `App.tsx`).

---

## Suggested order of execution (2-week sprint)

1. M4 → M1 → M2  
2. M5 (document while testing M2)  
3. M3 (parallel with dev on S2/S4)  
4. S4 → S3 → S2 → S5  
5. S1 (spill to week 3 if needed)  
6. N* as backlog after go-live

---

## Definition of “client ready” (minimum)

- [ ] All **Must** items closed or explicitly waived in writing by the client.  
- [ ] Staging sign-off using [QA_SIGNOFF_CHECKLIST.md](./QA_SIGNOFF_CHECKLIST.md).  
- [ ] One **production** dry run with real roles (not only super_admin).  
