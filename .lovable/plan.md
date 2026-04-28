## Activate Dorcus Banda's loan + post her K100 day-1 payment

She got the Marketeer loan offline on **24 April 2026** with K2,000 principal, K2,600 total (30% / 26 daily installments of K100), and has paid **K100 on day 1**. The system has her as `pending` with no schedule. We need to bring her in line with field reality without breaking ledger parity.

### Excel evidence (Marketeer Loans sheet, row 86)
- Date marker above her row: **24th APRIL, 2026**
- Principal 2,000 / Interest 600 / Total 2,600 / Daily repayment 100
- Day-1 collection cell: **100** (only one day-cell filled)

### Current DB state
- loan_id: `d8200188-d6e8-407d-b747-fab2a8628e88`
- status: `pending`, term_unit: `days`, loan_term_months: 26
- product: MARKETEER, source: `internal`, no schedule rows yet, no disbursement row

### Why this needs a one-off SQL migration (not the UI)

The canonical `complete_disbursement` RPC always writes `disbursed_at = now()`, and the schedule trigger uses `CURRENT_DATE` as the anchor. Putting it through the normal admin flow today would start her schedule on **28 Apr** instead of **24 Apr**, mis-aligning every installment by 4 days and making her day-1 payment look 4 days late.

### Migration steps (single transaction)

1. Insert a `disbursements` row: K2,000 against ZANACO BANK, `status='completed'`, `disbursed_at='2026-04-24 12:00 UTC'`, `transaction_reference='OFFLINE-IMPORT-DORCUS-2026-04-24'`.
2. Insert matching `account_transactions` debit row against ZANACO (–K2,000).
3. Update `loan_applications`: `status='active'`, `disbursed_at='2026-04-24 12:00 UTC'`, `approval_stage='disbursed'`, `approved_at='2026-04-24 12:00 UTC'`.
4. Insert `loan_status_transitions` rows for the audit trail: pending→approved→awaiting_disbursement→disbursed→active, all timestamped 24 Apr.
5. **Manually generate the 26-day Marketeer schedule** anchored at 24 Apr (skipping Sundays), bypassing the trigger.
6. Mark installment #1 as `paid`: `amount=100, principal_paid≈77, interest_paid≈23, paid_date='2026-04-24', payment_method='cash', transaction_reference='OFFLINE-IMPORT-DORCUS-DAY1'`.
7. Insert matching `account_transactions` credit row against ZANACO (+K100).
8. Log both events to `audit_logs` with action `OFFLINE_IMPORT_BACKDATED`.

### Net Zanaco impact
–K2,000 (disbursement) + K100 (day-1 collection) = **–K1,900** → 57,845 → **55,945**.

### Idempotency
Guard at top: `IF EXISTS (SELECT 1 FROM disbursements WHERE loan_id='<dorcus>' AND transaction_reference='OFFLINE-IMPORT-DORCUS-2026-04-24') THEN RAISE NOTICE 'already imported'; RETURN; END IF;`. Re-runs are no-ops.

### What I will NOT do
- Touch any other Marketeer loan (the broader 65-loan import is still pending separate approval).
- Disable notification triggers — they will fire and silently fail on placeholder contact details. Tell me if you'd rather I wrap the run in `SET LOCAL session_replication_role = replica`.

### Post-run verification
- `loan_applications` status = `active`, `disbursed_at` = 24 Apr.
- 26 schedule rows, installment #1 status `paid` with `paid_date = 24 Apr`.
- `account_transactions` rows tie out: disbursement debit + day-1 credit linked to her loan.
- ZANACO balance moves from 57,845 to 55,945.
