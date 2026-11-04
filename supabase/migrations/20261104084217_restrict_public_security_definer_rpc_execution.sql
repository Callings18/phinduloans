-- Remove implicit PUBLIC/anon EXECUTE access from SECURITY DEFINER routines.
-- Preserve explicit grants to authenticated and service roles. The public
-- landing-stats function is intentionally callable without authentication.
DO $migration$
DECLARE
  fn record;
  authenticated_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'authenticated');
  auth_was_explicit boolean;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proacl, p.proowner
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname <> 'get_public_landing_stats'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(fn.proacl, acldefault('f', fn.proowner))) AS acl
      WHERE acl.grantee = authenticated_oid
        AND acl.privilege_type = 'EXECUTE'
    ) INTO auth_was_explicit;

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
      fn.oid::regprocedure
    );

    IF auth_was_explicit THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated',
        fn.oid::regprocedure
      );
    END IF;
  END LOOP;
END;
$migration$;
