-- ============================================================================
-- One-shot helper: grant the super_admin role to an existing profile by
-- partial name / exact email / exact NRC. INTENDED TO BE RUN MANUALLY VIA THE
-- SUPABASE SQL EDITOR — not as part of automatic migrations.
--
-- Why a function and not a hard-coded INSERT?
--   * Production identifiers (Ireen's email / NRC / phone) shouldn't be
--     committed to source control.
--   * Different environments (staging, prod) may have different user IDs.
--
-- HOW TO USE (Supabase SQL editor or psql):
--   SELECT public.grant_super_admin_to(
--     p_email     => 'ireen@phinduloans.com',  -- exact email, optional
--     p_nrc       => null,                     -- exact NRC, optional
--     p_name_like => null                      -- partial name match, optional
--   );
--
-- The function:
--   * Resolves a single profile from any of the three optional inputs.
--   * Errors out if 0 or >1 profiles match (safety).
--   * Upserts user_roles to role='super_admin'.
--   * Returns the resolved user_id and final role for confirmation.
--
-- It is idempotent: running it again for the same person is a no-op.
-- It is safe to drop afterwards if you don't want to leave the helper around.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.grant_super_admin_to(
  p_email     text DEFAULT NULL,
  p_nrc       text DEFAULT NULL,
  p_name_like text DEFAULT NULL
)
RETURNS TABLE(user_id uuid, full_name text, email text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_match_count integer;
BEGIN
  IF p_email IS NULL AND p_nrc IS NULL AND p_name_like IS NULL THEN
    RAISE EXCEPTION 'Provide at least one of p_email, p_nrc, or p_name_like';
  END IF;

  -- Count matches first so we can give a clear error if zero or many.
  SELECT count(*) INTO v_match_count
  FROM public.profiles p
  WHERE (p_email     IS NULL OR lower(p.email) = lower(p_email))
    AND (p_nrc       IS NULL OR p.nrc_number = p_nrc)
    AND (p_name_like IS NULL OR p.full_name ILIKE '%' || p_name_like || '%');

  IF v_match_count = 0 THEN
    RAISE EXCEPTION 'No profile matches email=%, nrc=%, name_like=%',
      p_email, p_nrc, p_name_like;
  END IF;

  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Multiple profiles (%) match — narrow the filters', v_match_count;
  END IF;

  SELECT p.id INTO v_user_id
  FROM public.profiles p
  WHERE (p_email     IS NULL OR lower(p.email) = lower(p_email))
    AND (p_nrc       IS NULL OR p.nrc_number = p_nrc)
    AND (p_name_like IS NULL OR p.full_name ILIKE '%' || p_name_like || '%')
  LIMIT 1;

  -- Upsert role. Using ON CONFLICT (user_id) so the same person can't end up
  -- with two role rows (this matches the AdminStaff UI's behaviour).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN QUERY
  SELECT ur.user_id, p.full_name, p.email, ur.role::text
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_super_admin_to(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_super_admin_to(text, text, text) TO service_role;
-- Intentionally NOT granted to authenticated/anon — must be run by a DB owner
-- or via the Supabase SQL editor (which uses service_role).

COMMENT ON FUNCTION public.grant_super_admin_to(text, text, text) IS
  'Manual helper: grants super_admin to a single profile resolved by email, NRC, or partial name. Intended for one-off use in the Supabase SQL editor.';

-- ============================================================================
-- DIAGNOSTIC HELPERS — read-only, safe to run any time.
-- ============================================================================

-- Quick lookup: who matches a partial name? Useful before granting.
--   SELECT * FROM public.find_user_for_role('Ireen');
CREATE OR REPLACE FUNCTION public.find_user_for_role(p_query text)
RETURNS TABLE(user_id uuid, full_name text, email text, phone text, nrc_number text, current_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.nrc_number,
    COALESCE(ur.role::text, 'user') AS current_role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.full_name ILIKE '%' || p_query || '%'
     OR p.email ILIKE '%' || p_query || '%'
     OR p.phone ILIKE '%' || p_query || '%'
     OR p.nrc_number ILIKE '%' || p_query || '%'
  ORDER BY p.full_name NULLS LAST
  LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.find_user_for_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_for_role(text) TO service_role, authenticated;

COMMENT ON FUNCTION public.find_user_for_role(text) IS
  'Read-only directory search across profiles for the role-grant flow. Returns up to 25 partial matches with their current role.';
