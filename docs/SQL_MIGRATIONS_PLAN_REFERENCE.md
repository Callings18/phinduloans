# SQL Migrations – RBAC, Approval Workflow, Payroll, Reporting (Plan Implementation)

Apply these in **filename order** (Supabase runs them automatically by name).  
Paths are relative to `supabase/migrations/`.

---

## 1. `20260210_audit_logs_module.sql`

Adds optional `module` column to `audit_logs`.

```sql
-- Add optional module column to audit_logs for RBAC/reporting
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT;
COMMENT ON COLUMN public.audit_logs.module IS 'Module/category for the action (e.g. loans, disbursement, products). Can mirror entity_type.';
```

---

## 2. `20260210_rbac_roles_permissions.sql`

Creates `roles`, `permissions`, `role_permissions`, seeds them, and adds `has_permission`, `get_my_permissions`.

*(Full file: 199 lines – creates roles/permissions tables, RLS, seeds permissions and role-permission mappings, defines has_permission and get_my_permissions RPCs.)*

---

## 3. `20260210_approval_workflow_and_loan_notes.sql`

Adds workflow columns to `loan_applications` and creates `loan_notes` with RLS.

*(Full file: 71 lines – document_verified_by/at, finance_verified_by/at, disbursed_by, approval_stage; loan_notes table and policies.)*

---

## 4. `20260210_transition_loan_status_rpc.sql`

RPC `transition_loan_status(loan_id, action)` for verify_documents, finance_approve, approve.

*(Full file: 91 lines – permission checks and audit log inserts.)*

---

## 5. `20260210_loan_applications_delete_policy.sql`

Restricts deletes to early stages or super_admin.

```sql
DROP POLICY IF EXISTS "Admins can delete applications" ON public.loan_applications;
CREATE POLICY "Staff can delete applications in early stages"
  ON public.loan_applications FOR DELETE
  USING (
    ( status IN ('pending', 'rejected', 'under_review') AND public.has_permission(auth.uid(), 'loans', 'delete') )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
```

---

## 6. `20260210_employees_commission_branch.sql`

Adds commission and branch to employees.

```sql
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS branch TEXT;
COMMENT ON COLUMN public.employees.commission_percentage IS 'Commission % on loans processed by this employee';
COMMENT ON COLUMN public.employees.branch IS 'Branch or location for reporting and filtering';
```

---

## 7. `20260210_commission_calculations.sql`

Creates `commission_calculations` table and RLS.

*(Full file: 29 lines – table, indexes, RLS policy for admins.)*

---

## 8. `20260210_officer_loan_stats_rpc.sql`

Adds `officer_loan_stats(period_start, period_end)` and `portfolio_at_risk(as_of_date)`.

*(Full file: 122 lines – per-officer stats and PAR %.)*

---

## Optional (already in repo, not part of plan core)

- `20260209_blacklist_expires_at.sql`
- `20260209_log_auth_events.sql`
- `20260209_profile_verification_status.sql`
- `20260209_unique_nrc_phone_profiles.sql`

---

**Run order for plan-only:**  
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (by filename; Supabase migration runner does this automatically).
