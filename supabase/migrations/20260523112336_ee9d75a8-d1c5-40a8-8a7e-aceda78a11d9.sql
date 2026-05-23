CREATE OR REPLACE FUNCTION public.apply_loan_penalties(p_loan_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loan record;
  v_product record;
  v_user_id uuid;
  v_is_authorized boolean := false;
  v_earliest_overdue record;
  v_days_overdue integer;
  v_grace integer;
  v_penalty_rate numeric;
  v_cycles_due integer;
  v_existing_cycles integer;
  v_incremental_cycles integer;
  v_per_cycle_penalty numeric;
  v_incremental_penalty numeric := 0;
  v_new_total_penalties numeric;
BEGIN
  v_user_id := auth.uid();

  v_is_authorized := (
    public.has_role(v_user_id, 'admin'::app_role)
    OR public.has_role(v_user_id, 'super_admin'::app_role)
    OR public.has_role(v_user_id, 'collections_officer'::app_role)
    OR public.has_role(v_user_id, 'loan_officer'::app_role)
    OR public.has_role(v_user_id, 'finance_officer'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.loan_applications
      WHERE id = p_loan_id AND user_id = v_user_id
    )
  );

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: You do not have permission to access this loan';
  END IF;

  SELECT * INTO v_loan FROM public.loan_applications WHERE id = p_loan_id;
  IF v_loan IS NULL THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;

  -- Product config (rate + grace). Default penalty 15% per week, max 2 cycles.
  SELECT
    COALESCE(late_payment_penalty_percent, 15),
    COALESCE(grace_period_days, 0)
  INTO v_penalty_rate, v_grace
  FROM public.loan_products
  WHERE id = v_loan.loan_product_id;

  v_penalty_rate := COALESCE(v_penalty_rate, 15);
  v_grace := COALESCE(v_grace, 0);

  -- Earliest still-due installment (pending or overdue)
  SELECT id, due_date
  INTO v_earliest_overdue
  FROM public.loan_repayments
  WHERE loan_id = p_loan_id
    AND status IN ('pending', 'overdue')
    AND due_date < CURRENT_DATE
  ORDER BY due_date ASC
  LIMIT 1;

  IF v_earliest_overdue.id IS NULL THEN
    RETURN 0;
  END IF;

  v_days_overdue := (CURRENT_DATE - v_earliest_overdue.due_date) - v_grace;
  IF v_days_overdue < 7 THEN
    RETURN 0;
  END IF;

  -- Weekly cadence, capped at 2 cycles (matches cron rule)
  v_cycles_due := LEAST(2, FLOOR(v_days_overdue::numeric / 7))::integer;
  v_existing_cycles := COALESCE(v_loan.penalty_count, 0);

  IF v_cycles_due <= v_existing_cycles THEN
    RETURN 0;
  END IF;

  v_incremental_cycles := v_cycles_due - v_existing_cycles;
  v_per_cycle_penalty := ROUND(v_loan.loan_amount * (v_penalty_rate / 100.0) * 100) / 100.0;
  v_incremental_penalty := ROUND(v_per_cycle_penalty * v_incremental_cycles * 100) / 100.0;
  v_new_total_penalties := COALESCE(v_loan.total_penalties, 0) + v_incremental_penalty;

  -- Attach the incremental penalty to the earliest overdue installment
  UPDATE public.loan_repayments
  SET penalty_amount = COALESCE(penalty_amount, 0) + v_incremental_penalty,
      status = 'overdue'
  WHERE id = v_earliest_overdue.id;

  -- Update loan: penalty counters and (if still active) flip to defaulted
  UPDATE public.loan_applications
  SET total_penalties = v_new_total_penalties,
      penalty_count = v_cycles_due,
      status = CASE WHEN status = 'active' THEN 'defaulted'::loan_status ELSE status END,
      defaulted_at = CASE
        WHEN status = 'active' AND defaulted_at IS NULL THEN NOW()
        ELSE defaulted_at
      END,
      updated_at = NOW()
  WHERE id = p_loan_id;

  RETURN v_incremental_penalty;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_loan_penalties(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_loan_penalties(uuid) TO authenticated, service_role;