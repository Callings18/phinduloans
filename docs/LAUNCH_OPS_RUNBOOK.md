# Launch Ops Runbook — Phindu LMS

Last updated: 2026-04-28 · Owner: Platform Team

This runbook is the single source of truth for production launch operations,
incident response, and rollback procedures. It complements the existing
`PRODUCTION_LAUNCH_CHECKLIST.md` and `MIGRATIONS_FOR_DEPLOY.md`.

---

## 1. PITR Restore Drill Plan

**Scope:** Validate that Lovable Cloud (managed Supabase) point-in-time restore
returns the database to a known-good state with verified integrity.

### Frequency
- **Pre-launch:** once, sign-off required.
- **Post-launch:** quarterly, recorded in this file.

### Procedure
1. **Snapshot baseline metrics** on production:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM public.loan_applications)        AS loans,
     (SELECT COUNT(*) FROM public.loan_repayments)          AS repayments,
     (SELECT COUNT(*) FROM public.disbursements)            AS disbursements,
     (SELECT COUNT(*) FROM public.audit_logs)               AS audit,
     (SELECT MAX(created_at) FROM public.audit_logs)        AS last_event,
     pg_database_size(current_database())                   AS db_bytes;
   ```
2. **Request PITR** to a target timestamp (≤ 5 minutes ago) via Lovable Cloud
   → Backend → Advanced settings → Restore. Restore into a **scratch project**,
   never overwrite production.
3. **Wait for `ACTIVE_HEALTHY`** on the restored project (`cloud_status` tool).
4. **Re-run baseline query** on the restored project; record deltas.
5. **Spot-check integrity**: pick 3 recent loans on production, verify the
   same row exists on the restored copy with identical
   `total_repayment`, `status`, and last `audit_logs` row.
6. **Record outcome** in §6 of this file: timestamp, RTO (restore time), RPO
   (data-loss window), pass/fail, signer.

### Pass criteria
- Restore completes within 30 min for current DB size (~200 MB).
- Row counts within expected tolerance (RPO ≤ 5 min).
- Spot-checked loans match.

---

## 2. P0 Incident Runbook

### 2.1 Classification
| Class | Trigger | Initial response time |
|-------|---------|------------------------|
| **P0** | Money loss, data corruption, mass-notification leak, total auth lockout | 15 min |
| **P1** | Single-user data exposure, partial outage, disbursement queue stall | 1 hour |
| **P2** | Slow queries, non-critical edge function failure | next business day |

### 2.2 P0 Playbooks

#### A. Payment double-post / financial drift
**Signal:** `account_transactions` shows two `repayment` rows for same `reference_id`,
or borrower complaint of double-deduction.
1. **Freeze repayment intake**:
   ```sql
   UPDATE public.system_settings
   SET value = jsonb_set(value, '{repayments_enabled}', 'false'::jsonb)
   WHERE key = 'feature_flags';
   ```
2. Identify duplicates:
   ```sql
   SELECT reference_id, COUNT(*) FROM public.account_transactions
   WHERE transaction_type='repayment' AND created_at > now() - interval '24 hours'
   GROUP BY reference_id HAVING COUNT(*) > 1;
   ```
3. Reverse the duplicate via compensating `account_transactions` insert
   (do **not** delete — preserve audit chain).
4. Restore repayment intake flag once cause identified.
5. Open follow-up incident review.

#### B. Mass notification leak (duplicate blasts)
**Signal:** spike in `notification_logs` rows with identical `(recipient,title,message)`
within 5-minute window.
1. **Stop the queue processor** (disable cron schedule for
   `process-notification-queue` in Lovable Cloud → Functions → Schedules).
2. Mark suspect rows cancelled:
   ```sql
   UPDATE public.notification_logs SET status='cancelled', error_message='Incident: paused'
   WHERE status='pending' AND created_at > '<incident_start>';
   ```
3. Verify `idempotency_key` index intact:
   `\d public.notification_logs` → must show `notification_logs_idempotency_key_key`.
4. Resume queue once root cause identified.

#### C. Auth lockout / mass session failure
1. Check `cloud_status` for project health.
2. If healthy, inspect `auth.users` recent activity and `audit_logs` for
   `PERMISSION_DENIED` spikes.
3. If a recent migration changed RLS, **revert** the migration (see §3) and
   re-deploy.

#### D. DB corruption / unexplained data loss
1. Capture `pg_database_size` and row counts immediately.
2. Initiate PITR restore drill (§1) into scratch project at last good
   timestamp.
3. Promote restored project only with explicit Founder sign-off — this is a
   last-resort action.

### 2.3 Kill-switches via `system_settings`
The `system_settings.feature_flags` JSONB supports runtime toggles. Suggested
keys (add as needed):
- `repayments_enabled` (bool) — gate `record_loan_payment` UI calls.
- `disbursements_enabled` (bool) — gate `complete_disbursement` UI calls.
- `notifications_enabled` (bool) — short-circuit `send_notification_via_edge_function`.
- `new_applications_enabled` (bool) — gate borrower apply flow.

---

## 3. Migration Rollback Checklist

For each migration in `supabase/migrations/`, the reverse path is documented
inline below for the **5 most recent** migrations. New migrations must add
their reverse SQL here on merge.

| Migration | Forward summary | Reverse SQL |
|-----------|-----------------|-------------|
| `20260428104228_*` Lock down `apply_loan_penalties` | Revoked anon EXECUTE | `GRANT EXECUTE ON FUNCTION public.apply_loan_penalties(uuid) TO anon, PUBLIC;` |
| `20260428103345_*` Perf indexes + schema drift fix | Added 8 indexes, 3 columns on `notification_logs`, trigger | `DROP TRIGGER trg_notification_logs_updated_at ON public.notification_logs; DROP INDEX IF EXISTS public.idx_notification_logs_status_created, public.idx_notification_logs_user_created, public.idx_notification_logs_recipient_created, public.idx_audit_logs_entity_created, public.idx_audit_logs_user_created, public.idx_audit_logs_action_created, public.idx_account_transactions_account_created, public.idx_account_transactions_reference; ALTER TABLE public.notification_logs DROP COLUMN IF EXISTS retry_count, DROP COLUMN IF EXISTS error_message, DROP COLUMN IF EXISTS updated_at;` |
| `20260428100339_*` Completion gate hardening | Patched `record_loan_payment` to require principal reconciliation | Revert via prior function definition (kept in git history) |
| `20260428100216_*` Notification idempotency | Added `idempotency_key` + unique index, cleaned dup repayments | `DROP INDEX IF EXISTS public.notification_logs_idempotency_key_key; ALTER TABLE public.notification_logs DROP COLUMN IF EXISTS idempotency_key;` (do not restore deleted dup rows) |
| `20260428094615_*` Audit lockdown | Removed broad `audit_logs` insert policy | Recreate prior policy from git history (NOT recommended) |

### Standard rollback procedure
1. **Frontend:** Lovable chat history → revert button on the offending message,
   OR History tab → select prior version.
2. **Database:** apply the reverse SQL above as a new migration. Never delete
   migration files from `supabase/migrations/`.
3. **Edge functions:** redeploy prior version from git history via Lovable.
4. **Verify:** re-run §4 smoke checklist.

---

## 4. Post-Deploy Smoke Checklist

Run within 5 minutes of every production deploy. Pass = all green.

### Database health
- [ ] `cloud_status` returns `ACTIVE_HEALTHY`.
- [ ] `SELECT MAX(created_at) FROM audit_logs` is within 10 minutes of now.
- [ ] No new `PERMISSION_DENIED` spikes vs. prior 24 h baseline.

### Lifecycle smoke (read-only)
- [ ] At least one loan in each non-terminal status: pending, active, completed.
- [ ] No `loan_applications` rows in invalid status transitions (trigger
      enforced — should be impossible).
- [ ] No duplicate `(loan_id, installment_number)` rows.
- [ ] No `account_transactions` referencing missing accounts.

### Notifications
- [ ] `notification_logs` queue depth (status='pending') under 100.
- [ ] No new duplicate-blast groups in last 1 hour.

### Edge functions
- [ ] `process-notification-queue` boot logs present in last hour.
- [ ] `payment-reminder-cron` last successful run within last 24 h.

### Frontend
- [ ] `https://phindu.com` loads under 3 s.
- [ ] Login flow works for one staff and one borrower test account.
- [ ] Borrower dashboard renders loan summary.

---

## 5. Environment & Secrets Parity

Single environment (production Lovable Cloud project):
- Project ref: `yqrfheavftgybhcafzpt`
- Custom domain: `phindu.com`
- Secrets managed in Lovable Cloud → Backend → Secrets (runtime).
- Build secrets (npm tokens, etc.): Workspace Settings → Build Secrets.

**No staging environment** — accepted risk, mitigated by:
- Lovable chat history per-message rollback,
- managed PITR backups,
- migration validator in CI before merge.

---

## 6. PITR Drill Log

| Date | Operator | Target timestamp | RTO | RPO | Outcome | Notes |
|------|----------|------------------|-----|-----|---------|-------|
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | Pre-launch drill required |

---

## 7. Sign-off

- Platform Lead: _________________ Date: _______
- Founder: _________________ Date: _______
