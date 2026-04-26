ALTER TABLE public.disbursements DISABLE TRIGGER notify_disbursement_trigger;

-- PHASE A: Backfill 86 ledger rows (non-mutating)
INSERT INTO public.account_transactions (
  account_id, transaction_type, amount,
  balance_before, balance_after,
  destination, reference_type, reference_id,
  notes, created_at
)
SELECT
  d.source_account_id, 'disbursement', d.amount,
  a.balance, a.balance,
  la.full_name, 'disbursement', d.id,
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
    WHERE t.reference_type = 'disbursement' AND t.reference_id = d.id
  );

-- PHASE B: Audit summary
INSERT INTO public.audit_logs (action, entity_type, entity_id, module, details)
VALUES (
  'LEGACY_LEDGER_BACKFILL', 'system', gen_random_uuid(), 'reconciliation',
  jsonb_build_object(
    'marker','legacy_backfill_20260427','phase','A',
    'rows_inserted', (SELECT COUNT(*) FROM public.account_transactions WHERE notes LIKE 'legacy_backfill_20260427:%'),
    'note','Non-mutating ledger backfill for historical disbursements.'
  )
);

-- PHASE C: 6 synthetic completed disbursements
INSERT INTO public.disbursements (
  loan_id, amount, disbursement_method, status,
  transaction_reference, disbursed_at, created_at
)
SELECT
  tl.id, tl.loan_amount, 'legacy', 'completed',
  'LEGACY-BF-' || substr(tl.id::text, 1, 8),
  COALESCE(tl.disbursed_at, now()),
  COALESCE(tl.disbursed_at, now())
FROM public.loan_applications tl
WHERE tl.id IN (
  '9d62ea34-5001-49f8-955a-8e126fc39f9d','62886ccc-b7b5-4b09-b764-ffea55a99470',
  '58e4affa-0d00-46b8-a68e-02faf3483c63','7d06d3ed-5865-4a46-8c7e-edab0385c4e7',
  '7af10363-662c-4d9b-9a81-6769756a2374','e46b4511-5bbc-4208-8c2e-4bef3e929236'
)
AND NOT EXISTS (
  SELECT 1 FROM public.disbursements d
  WHERE d.loan_id = tl.id AND d.status = 'completed'
);

-- Phase C audit logs
INSERT INTO public.audit_logs (action, entity_type, entity_id, module, details)
SELECT 'LEGACY_DISBURSEMENT_RECONCILED','disbursement',d.id,'reconciliation',
  jsonb_build_object('marker','legacy_backfill_20260427','phase','C',
    'loan_id',d.loan_id,'amount',d.amount,'reference',d.transaction_reference)
FROM public.disbursements d
WHERE d.transaction_reference LIKE 'LEGACY-BF-%';

ALTER TABLE public.disbursements ENABLE TRIGGER notify_disbursement_trigger;