-- Run on seobil before pg_restore --data-only --schema=public (after truncate_public_before_data_restore.sql).
-- Supabase session pooler cannot use session_replication_role=replica or DISABLE TRIGGER ALL.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname AS name, c.relname AS table_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('loan_applications', 'disbursements')
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.name, r.table_name);
  END LOOP;
END $$;
