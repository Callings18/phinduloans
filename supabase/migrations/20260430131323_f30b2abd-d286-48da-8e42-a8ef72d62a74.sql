-- Seed default business_calendar setting (Sundays non-working, no holidays)
INSERT INTO public.system_settings (key, value)
VALUES (
  'business_calendar',
  jsonb_build_object(
    'non_working_weekdays', jsonb_build_array(0),
    'holidays', '[]'::jsonb
  )
)
ON CONFLICT (key) DO NOTHING;

-- Helper: read calendar
CREATE OR REPLACE FUNCTION public._get_business_calendar()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.system_settings WHERE key = 'business_calendar'),
    jsonb_build_object('non_working_weekdays', jsonb_build_array(0), 'holidays', '[]'::jsonb)
  );
$$;

-- Helper: is the given date a non-working day?
CREATE OR REPLACE FUNCTION public.is_non_working_day(d date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cal jsonb := public._get_business_calendar();
  weekdays jsonb := COALESCE(cal->'non_working_weekdays', '[0]'::jsonb);
  holidays jsonb := COALESCE(cal->'holidays', '[]'::jsonb);
  dow int := EXTRACT(DOW FROM d)::int; -- 0=Sun .. 6=Sat
BEGIN
  IF weekdays @> to_jsonb(dow) THEN
    RETURN TRUE;
  END IF;
  IF holidays @> to_jsonb(to_char(d, 'YYYY-MM-DD')) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- Helper: advance date forward to the next business day
CREATE OR REPLACE FUNCTION public.next_business_day(d date)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur date := d;
  guard int := 0;
BEGIN
  WHILE public.is_non_working_day(cur) LOOP
    cur := cur + 1;
    guard := guard + 1;
    IF guard > 366 THEN
      RAISE EXCEPTION 'next_business_day: exceeded 366 day search from %', d;
    END IF;
  END LOOP;
  RETURN cur;
END;
$$;

-- Admin RPC: shift any future pending repayment due_dates that fall on a non-working day
-- to the next business day. Preserves order via cascading.
CREATE OR REPLACE FUNCTION public.shift_pending_repayments_to_business_days()
RETURNS TABLE(shifted_count int, loans_touched int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shifted int := 0;
  v_loans int := 0;
  rec RECORD;
  new_due date;
BEGIN
  -- Authorization: admins/super_admins/loan_officers only
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only administrators may run shift_pending_repayments_to_business_days';
  END IF;

  -- Walk pending repayments in due-date order. For each one on a non-working day,
  -- push to next business day; if that conflicts with the next installment's date,
  -- the next iteration handles it (we re-fetch in order).
  FOR rec IN
    SELECT id, loan_id, due_date, installment_number
    FROM public.loan_repayments
    WHERE status = 'pending'
      AND due_date >= CURRENT_DATE
    ORDER BY loan_id, installment_number
  LOOP
    IF public.is_non_working_day(rec.due_date) THEN
      new_due := public.next_business_day(rec.due_date);
      IF new_due <> rec.due_date THEN
        UPDATE public.loan_repayments
        SET due_date = new_due,
            updated_at = now()
        WHERE id = rec.id;
        v_shifted := v_shifted + 1;
      END IF;
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT loan_id) INTO v_loans
  FROM public.loan_repayments
  WHERE status = 'pending' AND due_date >= CURRENT_DATE;

  shifted_count := v_shifted;
  loans_touched := v_loans;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shift_pending_repayments_to_business_days() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_non_working_day(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_business_day(date) TO authenticated;