

## Root Cause Found

The error `invalid input value for enum loan_status: "crb_failed"` reveals the actual problem: **the `crb_failed` and `pmic_pending` values were never added to the PostgreSQL `loan_status` enum type**.

The original enum only has: `pending`, `under_review`, `approved`, `rejected`, `disbursed`, `active`, `completed`, `defaulted`, `contract_signing`, `awaiting_disbursement`.

The trigger function `enforce_loan_application_status_transition` references `crb_failed` and `pmic_pending` in its IF conditions. When PostgreSQL evaluates `NEW.status IN (..., 'crb_failed', 'pmic_pending')`, it tries to cast those strings to the `loan_status` enum, which fails because they do not exist as valid enum values. This causes every status update to crash, even `pending → approved`.

## Fix Plan

### 1. Database Migration: Add missing enum values
Add `crb_failed` and `pmic_pending` to the `loan_status` enum so the trigger stops crashing.

```sql
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'crb_failed';
ALTER TYPE public.loan_status ADD VALUE IF NOT EXISTS 'pmic_pending';
```

### 2. Simplify the trigger for direct approval
Since CRB and PMIC are disabled, also update the trigger to cast status to `text` before comparison, preventing future enum mismatch crashes. Keep the `pending → approved` path open.

### 3. No frontend changes needed
The RPC `transition_loan_status` and the bulk approval code in `AdminApplications.tsx` are already correctly calling `approve` action. The only blocker is the database enum crash.

## Why previous fixes did not work
Multiple migrations rewrote the trigger function, but none added the missing enum values. Every rewrite still referenced `crb_failed`/`pmic_pending` in the IN clause, so the trigger kept crashing on every status update attempt.

