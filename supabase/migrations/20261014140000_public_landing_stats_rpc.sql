-- Aggregated marketing stats for phindu.com (no PII). Anon cannot SELECT loan rows directly (RLS).

CREATE OR REPLACE FUNCTION public.get_public_landing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_disbursed numeric := 0;
  v_total_apps int := 0;
  v_funded_apps int := 0;
  v_returning int := 0;
  v_profiles int := 0;
  v_approval_rate int := 98;
  v_funded_statuses text[] := ARRAY[
    'approved', 'disbursed', 'active', 'completed', 'defaulted'
  ];
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_disbursed
  FROM public.disbursements
  WHERE status = 'completed';

  SELECT count(*)::int,
         count(*) FILTER (WHERE status::text = ANY (v_funded_statuses))::int
  INTO v_total_apps, v_funded_apps
  FROM public.loan_applications;

  SELECT count(*)::int
  INTO v_returning
  FROM (
    SELECT user_id
    FROM public.loan_applications
    WHERE user_id IS NOT NULL
      AND status::text = ANY (v_funded_statuses)
    GROUP BY user_id
    HAVING count(*) >= 2
  ) t;

  SELECT count(*)::int INTO v_profiles FROM public.profiles;

  IF v_total_apps > 0 THEN
    v_approval_rate := round((v_funded_apps::numeric / v_total_apps) * 100)::int;
  END IF;

  RETURN jsonb_build_object(
    'total_disbursed', v_total_disbursed,
    'loans_given', v_funded_apps,
    'returning_borrowers', v_returning,
    'profile_count', v_profiles,
    'approval_rate', v_approval_rate,
    'total_applications', v_total_apps
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_stats() TO anon, authenticated;
