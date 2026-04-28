# Ring-fence Legal Fees on Disbursement

## What this does (plain English)

Today, when you disburse a K10,000 loan that has a 10% legal fee:
- The borrower correctly receives K9,000 (net).
- But the full K10,000 stays *recorded* in Zanaco — only a `legal_fee` note is written. **The K1,000 is not actually moved anywhere.** It looks like operating cash, gets re-spent on the next disbursement, and is gone when you actually need lawyers.

After this change:
- Zanaco is debited K9,000 (paid to borrower).
- Zanaco is **also** debited K1,000, which immediately lands in a brand-new account called **"Legal Fees Reserve"**.
- That K1,000 sits there, locked from disbursements, until you decide to spend it on a lawyer.
- Every K1,000 transfer carries the borrower's **full name, NRC, loan reference, date, and amount** — so you can always tally who funded what.
- Marketeer loans are unaffected (they don't use legal fees).

## How it works (technical)

### 1. New protected account

Create one row in `public.accounts`:
- `account_name`: "Legal Fees Reserve"
- `account_type`: `legal_reserve` (new value)
- `is_active`: `true`
- `is_protected`: `true` (new boolean column added to `accounts`)

`is_protected = true` means:
- The Disbursements UI **never shows it** in the "funding account" picker.
- An RPC guard rejects any attempt to use it as a `complete_disbursement` source.
- Admins can still view its balance and transaction history in the Accounts page.

### 2. RPC change — `complete_disbursement(p_disbursement_id, p_account_id, p_transaction_reference)`

Replace the current single-debit logic (which only debits net + writes a fake `legal_fee` audit row) with an **atomic two-leg transfer**:

```text
Source account (e.g. Zanaco)          Legal Fees Reserve
────────────────────────────          ──────────────────
balance: K100,000                     balance: K0
   │                                       ▲
   ├── debit K9,000 ─► borrower            │
   └── debit K1,000 ────────────────── credit K1,000
balance: K90,000                      balance: K1,000
```

Inside one transaction:
1. Lookup product → get `legal_fee_percent` and `legal_fee_deduction_mode`.
2. If `mode = 'upfront_net'` and `percent > 0`, compute `v_fee_amount`.
3. Look up the loan's borrower (full_name, NRC, loan reference number).
4. Lock + debit source account by `gross` (= net + fee). Existing balance check stays.
5. Write **two** `account_transactions` rows on the source account:
   - `transaction_type = 'disbursement'`, amount = net, destination = borrower name.
   - `transaction_type = 'legal_fee_transfer'`, amount = fee, destination = "Legal Fees Reserve".
6. Lock + credit the Legal Fees Reserve account by `v_fee_amount`.
7. Write a matching credit row on the reserve account:
   - `transaction_type = 'legal_fee_collection'`, amount = fee.
   - `notes` includes: borrower full name, NRC, loan ref, disbursement ref, fee % applied, gross amount, date.
   - `metadata` JSONB: `{ borrower_id, borrower_name, nrc_number, loan_id, loan_reference, disbursement_id, fee_percent, gross_amount }` — for clean reporting later.
8. Skip steps 6–7 entirely when `v_fee_amount = 0` (covers Marketeer and any product not configured for legal fees — no behavior change for those).
9. Loan status transition logic (approved → disbursed → active) stays exactly as it is today.

### 3. UI changes

**`HouseDisbursementsPage.tsx` and `AdminDisbursements.tsx`** — funding-account picker:
- Filter out `is_protected = true` accounts from the dropdown so nobody can disburse *from* the Legal Fees Reserve.

**`AdminAccounts.tsx`** — accounts list:
- Show a small "Protected — Legal Reserve" badge on the Legal Fees Reserve row.
- Disable any "transfer out" / "withdraw" button on protected accounts (admin-only "Release for legal action" button comes later if needed; out of scope for this pass).

**Loan Details modal** (existing financial summary):
- Add one read-only line under fees: "Legal fee K1,000 → Legal Fees Reserve (auto)".

### 4. Backfill (optional, recommended)

For any loans already disbursed where the product had legal fees, run a one-time migration that:
- Iterates `disbursements` where status = completed AND product had `upfront_net` legal fee AND no prior `legal_fee_collection` row exists.
- Sums `v_fee_amount` per disbursement, debits the original source account, credits the new Reserve account, writes the same audit pair.
- This is gated by a single boolean parameter so you can preview the dollar total before applying.

I will compute and show the historical total before running it, so you can confirm.

## What does NOT change

- Net amount the borrower receives (still gross − all upfront fees).
- Marketeer loans (mode = `none` → fee = 0 → no transfer).
- Loan status flow.
- All existing RLS, permission checks, and audit logging.

## Files to edit

- `supabase/migrations/<new>_legal_fees_reserve.sql` — adds `is_protected` column, creates the Reserve account, replaces `complete_disbursement` body.
- `src/pages/admin/houses/HouseDisbursementsPage.tsx` — filter protected accounts from dropdown.
- `src/pages/admin/AdminDisbursements.tsx` — same filter.
- `src/pages/admin/AdminAccounts.tsx` — protected badge + disable destructive actions.
- `src/components/admin/LoanDetailsModal.tsx` — show "→ Legal Fees Reserve" line.

## Acceptance checks

1. Disburse a 10% legal-fee loan of K10,000 from Zanaco:
   - Zanaco balance drops by K10,000.
   - Legal Fees Reserve balance increases by K1,000.
   - Borrower receives K9,000 (unchanged).
   - Reserve has a transaction row with borrower name, NRC, loan ref, date, K1,000.
2. Disburse a Marketeer loan of K500: Zanaco drops K500, Reserve unchanged.
3. Try to pick "Legal Fees Reserve" as a funding account → it is not in the dropdown.
4. Sum of Reserve balance == sum of `legal_fee_collection` transactions == sum across all `account_transactions.legal_fee_transfer` debits.

## Open question (will ask after approval if needed)

If a disbursement is later **reversed** (e.g. wrong borrower), should the legal fee also be swept back from the Reserve to Zanaco? Default proposal: **yes**, mirror the transfer in reverse, with a `legal_fee_reversal` row. Confirmable at implementation time.

Reply "go" to implement, or tell me what to adjust.
