-- Reporting views must not expose security-definer results to unauthenticated
-- callers. Run underlying row-level security as the requesting user.
ALTER VIEW public.account_cash_flow SET (security_invoker = true);
ALTER VIEW public.notification_stats SET (security_invoker = true);
ALTER VIEW public.wallet_summary SET (security_invoker = true);
ALTER VIEW public.court_cases_detailed SET (security_invoker = true);
ALTER VIEW public.account_balance_reconciliation SET (security_invoker = true);

REVOKE ALL ON TABLE
  public.account_cash_flow,
  public.notification_stats,
  public.wallet_summary,
  public.court_cases_detailed,
  public.account_balance_reconciliation
FROM PUBLIC, anon;

GRANT SELECT ON TABLE
  public.account_cash_flow,
  public.notification_stats,
  public.wallet_summary,
  public.court_cases_detailed,
  public.account_balance_reconciliation
TO authenticated;
