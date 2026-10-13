-- One-off cutover helper: Lovable export can contain duplicate completed
-- transaction_reference values (e.g. "collateral based loan"). Drop idempotency
-- indexes during COPY, then dedupe before recreating.

DROP INDEX IF EXISTS public.ux_disbursements_completed_txn_reference;
DROP INDEX IF EXISTS public.ux_account_transactions_disbursement_reference;

-- After pg_restore -t disbursements and account_transactions, run:
-- SELECT scripts/dedupe below via the second part of this file.

-- Dedupe completed disbursement references (keep earliest created_at).
WITH ranked AS (
  SELECT
    id,
    transaction_reference,
    ROW_NUMBER() OVER (
      PARTITION BY transaction_reference
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.disbursements
  WHERE status = 'completed'
    AND transaction_reference IS NOT NULL
)
UPDATE public.disbursements d
SET transaction_reference = d.transaction_reference || ' [' || d.id::text || ']'
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

-- Remove duplicate disbursement ledger rows (double-posted on source).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.account_transactions
  WHERE transaction_type = 'disbursement'
    AND reference_id IS NOT NULL
)
DELETE FROM public.account_transactions t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_disbursements_completed_txn_reference
  ON public.disbursements (transaction_reference)
  WHERE status = 'completed' AND transaction_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_account_transactions_disbursement_reference
  ON public.account_transactions (reference_id)
  WHERE transaction_type = 'disbursement' AND reference_id IS NOT NULL;
