-- seobil cutover: wipe public schema + migration history, keep auth.users from Lovable dump.
-- Run once before a full `supabase db push --yes`. Does NOT affect Lovable (yqrf).

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO pg_database_owner;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- Re-apply Supabase defaults (minimal set)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;

DELETE FROM supabase_migrations.schema_migrations;
