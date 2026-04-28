## Marketeer-only import — deduplicated

Scope is now **only the `Marketeer Loans` sheet** (74 rows). I've already cross-checked every name against the live database to avoid duplicates.

### What's already in the system (skip these)

9 of the 74 Excel rows are already live in the database under `MARKETEER`, with matching principal and an active 26-day schedule. Most are mid-collection.

| # | Excel name | DB name | Principal | Status | Posted payments | Total paid |
|---|---|---|---|---|---|---|
| 1 | Chisenga Lucy | Chisenga Lucy | 1,500 | active | 11/26 | 825 |
| 2 | Civiness Mungamelo | Civiness mungamelo | 5,000 | active | 2/26 | 500 |
| 3 | Dorcus banda | dorcus banda | 2,000 | pending | 0/0 | 0 |
| 4 | Kapepe Ireen | Kapepe Ireen | 2,500 | active | 11/26 | 1,375 |
| 5 | Maureen Chandala | maureen chandalala | 1,000 | active | 4/26 | 200 |
| 6 | Munyinda Sauka Febby | Munyinda Sauka Febb | 1,000 | active | 11/26 | 550 |
| 7 | Rose Bwalya | Rose Bwalya | 2,000 | active | 11/26 | 1,100 |
| 8 | Shambweka Ireen | Shambweka Ireen | 1,000 | active | 11/26 | 530 |
| 9 | Tikambenji Tembo | Tikambenji Tembo | 200 | active | 11/26 | 110 |

These will be **skipped entirely** — no new loan, no new disbursement, no new repayments. They're flagged in the import report so collections can manually reconcile any per-day cells from the Excel that didn't get posted yet, but the script will not touch them.

> One outlier worth your eye: **Dorcus banda** is sitting at `pending` in the DB with no schedule. Either approve it manually or tell me to advance it through the standard `pending → approved → disbursed → active` chain as part of this run. I will not touch it without explicit say-so.

### What gets imported (65 new loans)

The remaining **65 Marketeer rows** are new and will be created end-to-end:

1. **Placeholder borrower** per name (sentinel NRC `IMP{seq}/26/N`, placeholder phone, `kyc_status='pending_offline_import'`, `city='Lusaka'`).
2. **Loan application** with full Marketeer binding: `product_code='MARKETEER'`, `term_unit='days'`, `repayment_frequency='daily'`, `loan_amount`, `total_repayment`, `interest_rate=30`, `loan_term_months=26` (the canonical Marketeer collection window per `MARKETEER_COLLECTION_DAYS`), `application_source='offline_import_2026_marketeer'`.
3. **Approve → awaiting_disbursement → complete_disbursement** RPC against the funding account. The existing `generate_repayment_schedule` trigger then auto-creates the 26-day daily schedule (skipping Sundays).
4. **Back-dated disbursement date** taken from the nearest preceding date marker in the sheet (14 Apr → 27 Apr 2026). Loans before the first marker (rows 2–5: Shambweka, Kapepe, Rose, plus Pe — but Shambweka/Kapepe/Rose are duplicates, so only **Pe** at row 5 has no marker → I'll use 14 Apr 2026 as default and flag it).
5. **Back-dated payments** per loan: for each numeric per-day cell, post a payment via `record_loan_payment` against the matching installment in order. Cells with `nil`, `to pay 40`, etc. → not posted (logged as notes). If a cell exceeds installment outstanding → cap at outstanding, log surplus to report.

### Funding account
Default: **`ZANACO BANK`** (only account with material balance). Total new principal will be ~K90k–K130k (estimating from the 65 rows). Since the live Zanaco balance is K57,845, I'll insert one funding top-up ledger entry equal to the total new principal before disbursing — tagged `import_topup_marketeer_2026` for easy reversal/audit.

If you'd rather use `mobile money`, `Stanbic`, `UAT Operating`, or `Cash`, say so before I run.

### Idempotency

The migration carries an `import_row_key` per row (sheet+row index, e.g. `MKT-7`) saved into `loan_applications.notes` JSON. Re-running the migration is a no-op for any row whose `import_row_key` already exists. The 9 existing-loan names are also added to a hard skip-list inside the migration, double-locked by exact name match against current MARKETEER loans.

### Build error fix (bundled)

Same commit will fix the `LoanDetailsModal.tsx` build error (lines 397, 412) by adding `destination_account_id?: string | null` to the local `Repayment` interface and including it in the SELECT that loads repayments.

### Deliverables

1. **Idempotent SQL migration** for the 65 new Marketeer loans + funding top-up + per-loan back-dated payments.
2. **`/mnt/documents/marketeer_import_report.csv`** — every Excel row (all 74) with: action taken (`SKIPPED_DUPLICATE` / `IMPORTED` / `NEEDS_MANUAL` for Dorcus), new loan id, principal, total repayment, marker date used, count of back-dated payments posted, count of cells flagged.
3. **`/mnt/documents/marketeer_payments_posted.csv`** — every payment that was back-dated, with installment #, due date, amount, paid date.
4. **Smoke checks** I'll paste back after run:
   - `count(*) FROM loan_applications WHERE application_source='offline_import_2026_marketeer'` → expect 65
   - sum(loan_amount) for those 65 vs Excel sum
   - zero trigger errors in `audit_logs` for the import window
   - Zanaco balance change = total principal disbursed (net of repayments collected back)

### What I'm not doing

- No notification suppression toggling — placeholder borrowers have synthetic phone/email so SMS/email triggers will fire-and-fail-silently. Tell me if you want `SET LOCAL session_replication_role = replica` wrapped around the import.
- No touching the 9 existing loans (no schedule edits, no payment top-ups). Their per-day cells in the Excel may diverge from what's already posted in the DB — that's a reconciliation conversation for collections, not this import.
- No fuzzy auto-merge of new placeholders against borrowers in *other* product houses. Exact-match-only against MARKETEER loans (already done above).

Confirm and I'll run the migration. If you want a different funding account, want Dorcus included in the run, or want notifications suppressed, say so now.