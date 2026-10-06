-- RPC to compute commission for a payroll period; returns per-employee commission (optionally write to commission_calculations via app)
-- Uses employees.commission_percentage and loans processed (assigned_to) disbursed in period
-- Date: 2026-02-11

CREATE OR REPLACE FUNCTION public.compute_commission_for_period(
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  commission_percentage NUMERIC,
  loans_count BIGINT,
  interest_earned NUMERIC,
  commission_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH emp_loans AS (
    SELECT
      e.id AS employee_id,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      COALESCE(e.commission_percentage, 0)::numeric AS commission_percentage,
      COUNT(la.id)::bigint AS loans_count,
      COALESCE(SUM(la.total_repayment - la.loan_amount), 0)::numeric AS interest_earned
    FROM public.employees e
    LEFT JOIN public.loan_applications la
      ON la.assigned_to = e.user_id
      AND la.status IN ('disbursed', 'active', 'completed')
      AND la.disbursed_at IS NOT NULL
      AND (la.disbursed_at::date >= p_period_start AND la.disbursed_at::date <= p_period_end)
    WHERE e.is_active = true AND COALESCE(e.commission_percentage, 0) > 0
    GROUP BY e.id, e.first_name, e.last_name, e.commission_percentage
  )
  SELECT
    el.employee_id,
    el.employee_name,
    el.commission_percentage,
    el.loans_count,
    el.interest_earned,
    ROUND((el.interest_earned * el.commission_percentage / 100.0)::numeric, 2) AS commission_amount
  FROM emp_loans el;
$$;

COMMENT ON FUNCTION public.compute_commission_for_period(DATE, DATE) IS 'Compute commission per employee for period from interest on loans (assigned_to) disbursed in period';
