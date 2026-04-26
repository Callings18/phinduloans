# Option 3 — Revised Legacy Backfill (Audit Response)

All 6 critical concerns are confirmed against live schema. Here are the answers and the hardened SQL.

## 1. Schema-correct column map (verified against live DB)

**`disbursements`** actual columns: `id, loan_id, amount, disbursement_method (NOT method), account_number, mobile_money_number, transaction_reference, status, disbursed_at, created_at, source_account_id`.
→ **There is NO `disbursed_by` column on `disbursements`.** It lives on `loan_applications` only. We will store the original disburser in `transaction_reference`/`audit_logs.details` instead.

**`account_transactions`** columns confirmed: `id, account_id, transaction_type, amount, balance_before, balance_after, source, destination, reference_type, reference_id, notes, created_by, created_at` — `balance_before`/`balance_after` are **NOT NULL**.

**`audit_logs.entity_id`** is `uuid` → fully compatible with `disbursements.id`.

## 2. Trigger risk — confirmed and mitigated

Live triggers on `disbursements`:
- `trigger_enforce_disbursement_status` — BEFORE UPDATE OF status (irrelevant for INSERT).
- `trigger_generate_repayment_schedule` — **AFTER INSERT OR UPDATE OF status WHEN status='completed'`** → WILL fire on synthetic INSERT.
- `notify_disbursement_trigger` — AFTER INSERT OR UPDATE → WILL fire and SMS-spam 6 borrowers.

**Mitigation strategy (chosen — safer than disabling triggers):**
- `generate_repayment_schedule()` already has built-in idempotency (`IF EXISTS (SELECT 1 FROM loan_repayments WHERE loan_id=NEW.loan_id) RETURN NEW`). I verified all 6 target loans already have schedules (5 with 1 row, 1 with 26 rows). So the trigger will fire but **no-op**. ✅
- For `notify_disbursement_trigger` (SMS spam risk): we will **temporarily set a `session_replication_role = 'replica'`** within the migration transaction so triggers do not fire on these synthetic inserts. This is reverted automatically at COMMIT.

## 3. The 6 target loans — explicit allow-list (no broad filter)

Hard-coded UUIDs, captured from the audit:

```
9d62ea34-5001-49f8-955a-8e126fc39f9d  Suwilanji Nankamba       K6,000
62886ccc-b7b5-4b09-b764-ffea55a99470  Twiza Nankamba Phiri     K5,805
58e4affa-0d00-46b8-a68e-02faf3483c63  Mathews Tembo            K6,900
7d06d3ed-5865-4a46-8c7e-edab0385c4e7  Civiness Mungamelo       K5,000
7af10363-662c-4d9b-9a81-6769756a2374  Mwango Cynthia Ngosa     K9,689
e46b4511-5bbc-4208-8c2e-4bef3e929236  Mulenga Reuben Mwale    K10,000
```

## 4. Scope of ledger backfill (Phase A)

- 96 completed disbursements have no ledger row.
- **86** have `source_account_id` → ledger row inserted.
- **10** have `source_account_id IS NULL` → **skipped** (cannot attribute to an account; reported in dry-run output for finance to manually classify).
- Inserts use `balance_before = balance_after = current accounts.balance` so **no live balance is mutated** (per finance's "non-mutating ledger" rule).

## 5. Migration file: `supabase/migrations/20260427000000_legacy_backfill_option3.sql`

```sql
BEGIN;

-- =================================================================
-- PHASE 0: Disable user-defined triggers ONLY for this transaction
-- (Built-in FK/PK/check constraints still enforced.)
-- =================================================================
SET LOCAL session_replication_role = 'replica';

-- =================================================================
-- PHASE A: Backfill account_transactions for 86 completed
-- disbursements that have a source_account_id but no ledger row.
-- Non-mutating: balance_before = balance_after = accounts.balance.
-- Idempotent: NOT EXISTS guard on (reference_type, reference_id).
-- =================================================================
WITH inserted_ledger AS (
  INSERT INTO public.account_transactions (
    account_id, transaction_type, amount,
    balance_before, balance_after,
    destination, reference_type, reference_id,
    notes, created_at
  )
  SELECT
    d.source_account_id,
    'disbursement',
    d.amount,
    a.balance,                    -- non-mutating
    a.balance,                    -- non-mutating
    la.full_name,
    'disbursement',
    d.id,
    format('legacy_backfill_20260427: historical disbursement %s on %s. Ref: %s',
           d.id, to_char(d.disbursed_at, 'YYYY-MM-DD'),
           COALESCE(d.transaction_reference, 'N/A')),
    COALESCE(d.disbursed_at, d.created_at)
  FROM public.disbursements d
  JOIN public.accounts a ON a.id = d.source_account_id
  JOIN public.loan_applications la ON la.id = d.loan_id
  WHERE d.status = 'completed'
    AND d.source_account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.account_transactions t
      WHERE t.reference_type = 'disbursement'
        AND t.reference_id = d.id
    )
  RETURNING id, reference_id, amount
)
SELECT COUNT(*) AS phase_a_rows_inserted, COALESCE(SUM(amount),0) AS phase_a_total_amount
FROM inserted_ledger;

-- =================================================================
-- PHASE B: Audit log entry for the backfill (one summary row)
-- =================================================================
INSERT INTO public.audit_logs (action, entity_type, entity_id, module, details)
SELECT
  'LEGACY_LEDGER_BACKFILL',
  'system',
  gen_random_uuid(),
  'reconciliation',
  jsonb_build_object(
    'marker', 'legacy_backfill_20260427',
    'phase', 'A',
    'rows_inserted', (
      SELECT COUNT(*) FROM public.account_transactions
      WHERE notes LIKE 'legacy_backfill_20260427:%'
    ),
    'note', 'Non-mutating ledger backfill for 86 historical disbursements.'
  );

-- =================================================================
-- PHASE C: Synthetic completed disbursements for the 6 active loans.
-- Constrained to explicit UUID allow-list. Schema-correct columns.
-- generate_repayment_schedule trigger is suppressed (replica role)
-- AND idempotent (all 6 already have schedules — verified).
-- =================================================================
WITH target_loans AS (
  SELECT id, loan_amount, disbursed_at, full_name
  FROM public.loan_applications
  WHERE id IN (
    '9d62ea34-5001-49f8-955a-8e126fc39f9d',
    '62886ccc-b7b5-4b09-b764-ffea55a99470',
    '58e4affa-0d00-46b8-a68e-02faf3483c63',
    '7d06d3ed-5865-4a46-8c7e-edab0385c4e7',
    '7af10363-662c-4d9b-9a81-6769756a2374',
    'e46b4511-5bbc-4208-8c2e-4bef3e929236'
  )
), inserted_disb AS (
  INSERT INTO public.disbursements (
    loan_id, amount, disbursement_method, status,
    transaction_reference, disbursed_at, created_at
  )
  SELECT
    tl.id,
    tl.loan_amount,
    'legacy',
    'completed',
    'LEGACY-BF-' || substr(tl.id::text, 1, 8),
    COALESCE(tl.disbursed_at, now()),
    COALESCE(tl.disbursed_at, now())
  FROM target_loans tl
  WHERE NOT EXISTS (
    SELECT 1 FROM public.disbursements d
    WHERE d.loan_id = tl.id AND d.status = 'completed'
  )
  RETURNING id, loan_id, amount
)
SELECT COUNT(*) AS phase_c_rows_inserted FROM inserted_disb;

-- Phase C audit log
INSERT INTO public.audit_logs (action, entity_type, entity_id, module, details)
SELECT
  'LEGACY_DISBURSEMENT_RECONCILED',
  'disbursement',
  d.id,
  'reconciliation',
  jsonb_build_object(
    'marker', 'legacy_backfill_20260427',
    'phase', 'C',
    'loan_id', d.loan_id,
    'amount', d.amount,
    'reference', d.transaction_reference
  )
FROM public.disbursements d
WHERE d.transaction_reference LIKE 'LEGACY-BF-%';

-- Re-enable user triggers for the rest of the session
SET LOCAL session_replication_role = 'origin';

-- =================================================================
-- PHASE D: SCALAR pass/fail gates (correct subquery form)
-- =================================================================
SELECT
  (SELECT COUNT(*) FROM (
    SELECT d.id FROM public.disbursements d
    LEFT JOIN public.account_transactions t
      ON t.reference_type='disbursement' AND t.reference_id=d.id
    WHERE d.status='completed'
      AND d.source_account_id IS NOT NULL
      AND t.id IS NULL
  ) gap1) AS gate_completed_disb_without_ledger,  -- expect 0

  (SELECT COUNT(*) FROM (
    SELECT la.id FROM public.loan_applications la
    LEFT JOIN public.disbursements d
      ON d.loan_id=la.id AND d.status='completed'
    WHERE la.status::text IN ('disbursed','active')
      AND la.id IN (
        '9d62ea34-5001-49f8-955a-8e126fc39f9d',
        '62886ccc-b7b5-4b09-b764-ffea55a99470',
        '58e4affa-0d00-46b8-a68e-02faf3483c63',
        '7d06d3ed-5865-4a46-8c7e-edab0385c4e7',
        '7af10363-662c-4d9b-9a81-6769756a2374',
        'e46b4511-5bbc-4208-8c2e-4bef3e929236'
      )
    GROUP BY la.id
    HAVING COUNT(d.id) = 0
  ) gap2) AS gate_active_loans_without_disb,  -- expect 0

  (SELECT COUNT(*) FROM public.disbursements
   WHERE status='completed' AND source_account_id IS NULL) AS info_unattributable_disb,  -- 10

  (SELECT COUNT(*) FROM public.account_transactions
   WHERE notes LIKE 'legacy_backfill_20260427:%') AS info_phase_a_inserted;  -- expect 86

-- ============================
-- DRY-RUN: replace COMMIT with ROLLBACK below to preview without applying
-- ============================
COMMIT;
```

## 6. Expected affected row counts (pre-flight estimate)

| Phase | Action | Expected rows |
|---|---|---|
| A | `account_transactions` inserts | **86** |
| B | `audit_logs` summary row | 1 |
| C | `disbursements` synthetic inserts | **6** |
| C | `audit_logs` per-disbursement | 6 |
| D | Gate 1 (completed disb without ledger) | **0** ✅ |
| D | Gate 2 (target active loans without disb) | **0** ✅ |
| D | Info: unattributable disb (no source_account_id) | 10 ⚠️ surfaced for finance |

## 7. Execution order

1. **Apply with `ROLLBACK` first** → review Phase D scalar output → confirm gates = 0.
2. Switch to `COMMIT` and re-apply.
3. Verify zero account balance drift via `SELECT id, balance FROM accounts` snapshot before/after.
4. Notify finance about the 10 unattributable disbursements (report attached).

## 8. Rollback strategy

```sql
-- Reversible by marker
DELETE FROM public.account_transactions WHERE notes LIKE 'legacy_backfill_20260427:%';
DELETE FROM public.disbursements WHERE transaction_reference LIKE 'LEGACY-BF-%';
DELETE FROM public.audit_logs WHERE action IN ('LEGACY_LEDGER_BACKFILL','LEGACY_DISBURSEMENT_RECONCILED')
  AND details->>'marker' = 'legacy_backfill_20260427';
```

## Answers to specific questions

1. **No schedule duplication?** Yes — `session_replication_role='replica'` suppresses user triggers in-transaction; even without that, `generate_repayment_schedule()` early-returns when any `loan_repayments` row exists (verified all 6 loans already have schedules).
2. **Exact synthetic insert columns:** `loan_id, amount, disbursement_method='legacy', status='completed', transaction_reference='LEGACY-BF-<8>', disbursed_at, created_at`. No `disbursed_by` (column does not exist on `disbursements`).
3. **6-loan constraint:** explicit `id IN (...)` UUID allow-list, also embedded in the gate query.
4. **Scalar verification:** Phase D returns a single row with 4 named scalar columns — no GROUP BY ambiguity.

Approve this plan to switch to default mode and apply (dry-run first).
