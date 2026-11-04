-- Compare each current account balance with the latest immutable account ledger row.
-- SECURITY INVOKER keeps the underlying account and transaction RLS policies in force.
CREATE OR REPLACE VIEW public.account_balance_reconciliation
WITH (security_invoker = true)
AS
SELECT
  a.id AS account_id,
  a.account_name,
  a.balance AS current_balance,
  latest.balance_after AS last_ledger_balance,
  latest.created_at AS last_ledger_at,
  (latest.account_id IS NOT NULL) AS has_ledger_entry,
  ROUND((a.balance - COALESCE(latest.balance_after, 0))::numeric, 2) AS variance
FROM public.accounts AS a
LEFT JOIN LATERAL (
  SELECT t.account_id, t.balance_after, t.created_at
  FROM public.account_transactions AS t
  WHERE t.account_id = a.id
  ORDER BY t.created_at DESC, t.id DESC
  LIMIT 1
) AS latest ON true;

GRANT SELECT ON public.account_balance_reconciliation TO authenticated;
