# Contract-first admin flow – migrations

## Summary

**No database migrations are required** for:

- Contract-first admin loan flow (gate disbursement on both signatures, Contract card in Admin Applications)
- Contract Management in Loan Details Modal (signing status, upload signed contract, Sign & Verify, View contract)

All of the above use existing `loan_applications` columns only.

## Why no migrations

The implementation uses **existing** `loan_applications` columns only:

- `borrower_signed` (boolean)
- `borrower_signed_at` (timestamp)
- `admin_signed` (boolean)
- `admin_signed_at` (timestamp)
- `signed_contract_url` (text – storage path)
- `signed_contract_uploaded_at` (timestamp)

“Fully signed” is derived in the app as:

`(borrower_signed OR signed_contract_url) AND admin_signed`

No new columns, tables, or constraints were added. Disbursement is gated in the UI and in `handleDisburse`; AdminDisbursements already enforced both signatures on the server.

## Optional (future): audit column

If you want an explicit audit field, run the migration below. It is **not required** for the current flow.

```sql
-- Optional: add contract_fully_signed_at for audit (run only if you want it)
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS contract_fully_signed_at timestamptz;

COMMENT ON COLUMN loan_applications.contract_fully_signed_at IS 'Set when both borrower and admin have signed; optional audit field.';
```
