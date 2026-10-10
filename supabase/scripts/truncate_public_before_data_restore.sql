-- Run on seobil ONLY before pg_restore --data-only --schema=public (cutover).
-- Does NOT touch auth.* — borrowers keep UUIDs already loaded from the Lovable dump.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
