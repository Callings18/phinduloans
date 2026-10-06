-- Phase 4.1: Officer-level loan stats RPC for performance dashboards
-- Returns per-officer (by assigned_to) metrics for a period
-- Date: 2026-02-10

DROP FUNCTION IF EXISTS public.officer_loan_stats(DATE, DATE);

CREATE OR REPLACE FUNCTION public.officer_loan_stats(p_period_start DATE, p_period_end DATE)
RETURNS TABLE (
  officer_id UUID,
  applications_submitted BIGINT,
  approved_count BIGINT,
  rejected_count BIGINT,
  disbursed_count BIGINT,
  approval_rate NUMERIC,
  default_count BIGINT,
  default_rate NUMERIC,
  avg_loan_size NUMERIC,
  portfolio_outstanding NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH period_loans AS (
    SELECT
      la.assigned_to AS officer_id,
      la.id,
      la.status,
      la.loan_amount
    FROM public.loan_applications la
    WHERE la.assigned_to IS NOT NULL
      AND la.created_at::date >= p_period_start
      AND la.created_at::date <= p_period_end
  ),
  outstanding AS (
    SELECT
      la.assigned_to AS officer_id,
      COALESCE(SUM(la.loan_amount) - COALESCE(SUM(rep.paid), 0), 0) AS outstanding
    FROM public.loan_applications la
    LEFT JOIN (
      SELECT loan_id, SUM(amount) AS paid
      FROM public.loan_repayments
      WHERE status = 'paid'
      GROUP BY loan_id
    ) rep ON rep.loan_id = la.id
    WHERE la.assigned_to IS NOT NULL
      AND la.status IN ('disbursed', 'active', 'defaulted')
    GROUP BY la.assigned_to
  ),
  defaults AS (
    SELECT assigned_to AS officer_id, COUNT(*) AS cnt
    FROM public.loan_applications
    WHERE assigned_to IS NOT NULL AND status = 'defaulted'
      AND created_at::date >= p_period_start AND created_at::date <= p_period_end
    GROUP BY assigned_to
  ),
  agg AS (
    SELECT
      pl.officer_id,
      COUNT(*)::BIGINT AS applications_submitted,
      COUNT(*) FILTER (WHERE pl.status = 'approved')::BIGINT AS approved_count,
      COUNT(*) FILTER (WHERE pl.status = 'rejected')::BIGINT AS rejected_count,
      COUNT(*) FILTER (WHERE pl.status = 'disbursed')::BIGINT AS disbursed_count,
      AVG(pl.loan_amount) AS avg_loan_size
    FROM period_loans pl
    GROUP BY pl.officer_id
  )
  SELECT
    a.officer_id,
    a.applications_submitted,
    a.approved_count,
    a.rejected_count,
    a.disbursed_count,
    CASE WHEN a.applications_submitted > 0 THEN ROUND(100.0 * (a.approved_count + a.disbursed_count) / a.applications_submitted, 2) ELSE 0 END AS approval_rate,
    COALESCE(d.cnt, 0)::BIGINT AS default_count,
    CASE WHEN a.applications_submitted > 0 THEN ROUND(100.0 * COALESCE(d.cnt, 0) / a.applications_submitted, 2) ELSE 0 END AS default_rate,
    ROUND(a.avg_loan_size::numeric, 2) AS avg_loan_size,
    COALESCE(o.outstanding, 0)::numeric AS portfolio_outstanding
  FROM agg a
  LEFT JOIN defaults d ON d.officer_id = a.officer_id
  LEFT JOIN outstanding o ON o.officer_id = a.officer_id
$$;

COMMENT ON FUNCTION public.officer_loan_stats(DATE, DATE) IS 'Per-officer loan stats for a date range (by assigned_to): applications, approved, rejected, disbursed, approval rate, default rate, avg loan size, portfolio outstanding';

-- PAR (portfolio at risk): overdue balance / total outstanding
DROP FUNCTION IF EXISTS public.portfolio_at_risk(DATE);

CREATE OR REPLACE FUNCTION public.portfolio_at_risk(p_as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_outstanding NUMERIC,
  overdue_balance NUMERIC,
  par_percent NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH outstanding_loans AS (
    SELECT la.id, la.loan_amount, la.total_repayment
    FROM public.loan_applications la
    WHERE la.status IN ('disbursed', 'active', 'defaulted')
  ),
  repaid AS (
    SELECT loan_id, SUM(amount) AS paid FROM public.loan_repayments WHERE status = 'paid' GROUP BY loan_id
  ),
  overdue AS (
    SELECT SUM(lr.amount) AS bal
    FROM public.loan_repayments lr
    WHERE lr.status = 'pending' AND lr.due_date < p_as_of_date
  )
  SELECT
    COALESCE(SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0), 0)::numeric AS total_outstanding,
    COALESCE((SELECT bal FROM overdue), 0)::numeric AS overdue_balance,
    CASE
      WHEN SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0) > 0
      THEN ROUND(100.0 * COALESCE((SELECT bal FROM overdue), 0) / (SUM(ol.loan_amount) - COALESCE(SUM(r.paid), 0)), 2)
      ELSE 0
    END::numeric AS par_percent
  FROM outstanding_loans ol
  LEFT JOIN repaid r ON r.loan_id = ol.id
$$;

COMMENT ON FUNCTION public.portfolio_at_risk(DATE) IS 'Portfolio at risk: total outstanding, overdue balance, PAR %';
