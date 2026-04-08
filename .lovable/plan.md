

# Fix: Loans Stuck at "Disbursed" — Triggers Missing from Database

## Root Cause

**All database triggers have been dropped.** The trigger functions exist (e.g., `generate_repayment_schedule`, `enforce_loan_application_status_transition`, `notify_loan_status_change`) but none are actually attached to any tables. This means:

1. When a disbursement is inserted with `status = 'completed'`, the `generate_repayment_schedule` trigger never fires — so no repayment schedule is created and the loan is never auto-set to `active`.
2. The loan status transition enforcement trigger doesn't run either.
3. No notification triggers fire (loan approval SMS/email, payment received, etc.).

## The Intended Flow

```text
Admin clicks "Disburse" on an awaiting_disbursement loan
  → Code inserts disbursement record (status: completed)
  → Code updates loan status to "disbursed"
  → TRIGGER: generate_repayment_schedule fires on disbursements INSERT
    → Creates repayment schedule based on loan product frequency
    → Sets loan status to "active"
```

Right now step 3 never happens because the trigger isn't attached.

## Fix Plan

### 1. Re-create all critical triggers (database migration)

Run a single migration that re-attaches all essential triggers:

- **`trigger_generate_repayment_schedule`** on `disbursements` — AFTER INSERT OR UPDATE — fires `generate_repayment_schedule()` when status becomes `completed`
- **`trigger_enforce_loan_status`** on `loan_applications` — BEFORE UPDATE — fires `enforce_loan_application_status_transition()`
- **`trigger_enforce_disbursement_status`** on `disbursements` — BEFORE UPDATE — fires `enforce_disbursement_status_transition()`
- **`trigger_enforce_payroll_status`** on `payroll_runs` — BEFORE UPDATE — fires `enforce_payroll_run_status_transition()`
- **`trigger_notify_loan_status_change`** on `loan_applications` — AFTER UPDATE OF status — fires `notify_loan_status_change()`
- **`trigger_notify_disbursement`** on `disbursements` — AFTER UPDATE OF status — fires `notify_disbursement()`
- **`trigger_notify_payment_received`** on `loan_repayments` — AFTER UPDATE OF status — fires `notify_payment_received()`
- **`trigger_log_loan_updates`** on `loan_applications` — AFTER UPDATE — fires `log_loan_changes()`
- **`trigger_log_repayment`** on `loan_repayments` — AFTER INSERT — fires `log_repayment_activity()`
- **`trigger_cancel_repayments_on_closure`** on `loan_applications` — AFTER UPDATE OF status — fires `cancel_repayments_on_loan_closure()`
- Various `update_*_updated_at` triggers on tables that need auto-timestamping

### 2. Fix the 10 already-disbursed loans (data cleanup)

The 10 loans that were disbursed are stuck at `disbursed` status with no repayment schedule. Since triggers can't retroactively fire, we need to:
- For each loan in `disbursed` status that has no repayment records, programmatically generate the schedule and set status to `active` inside the same migration using a DO block.

### 3. No frontend changes needed

The frontend code is already correct — it inserts the disbursement and updates the status. The only issue is the missing triggers.

## Files Changed

- New database migration: Re-create all triggers + backfill disbursed loans to active with schedules

## Why This Happened

Triggers were likely dropped during one of the earlier migration iterations that used `DROP TRIGGER IF EXISTS` statements without successfully re-creating them (possibly due to a migration error that rolled back the CREATE but not the DROP).

