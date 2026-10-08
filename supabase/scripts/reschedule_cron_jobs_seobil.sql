-- Run on project seobilifwyxhtjvsgqpc AFTER edge functions are deployed.
-- Replace placeholders before running (SQL Editor → run once).
--
-- Option A: set database setting (if your project uses this pattern):
--   ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
-- Option B: replace __SERVICE_ROLE_KEY__ below in the Authorization header literals.

-- Unschedule old job names (safe if missing)
DO $$ BEGIN PERFORM cron.unschedule('process-notification-queue-5min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('payment-reminder-morning'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('payment-reminder-midday'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('payment-reminder-evening'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Requires pg_cron + pg_net (from migrations)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 08:00, 13:00, 17:00 CAT ≈ 06:00, 11:00, 15:00 UTC
SELECT cron.schedule(
  'payment-reminder-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://seobilifwyxhtjvsgqpc.supabase.co/functions/v1/payment-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        nullif(current_setting('app.settings.service_role_key', true), ''),
        '__SERVICE_ROLE_KEY__'
      )
    ),
    body := jsonb_build_object('slot', 'morning', 'time', now()::text)
  );
  $$
);

SELECT cron.schedule(
  'payment-reminder-midday',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://seobilifwyxhtjvsgqpc.supabase.co/functions/v1/payment-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        nullif(current_setting('app.settings.service_role_key', true), ''),
        '__SERVICE_ROLE_KEY__'
      )
    ),
    body := jsonb_build_object('slot', 'midday', 'time', now()::text)
  );
  $$
);

SELECT cron.schedule(
  'payment-reminder-evening',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://seobilifwyxhtjvsgqpc.supabase.co/functions/v1/payment-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        nullif(current_setting('app.settings.service_role_key', true), ''),
        '__SERVICE_ROLE_KEY__'
      )
    ),
    body := jsonb_build_object('slot', 'evening', 'time', now()::text)
  );
  $$
);

SELECT cron.schedule(
  'process-notification-queue-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://seobilifwyxhtjvsgqpc.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        nullif(current_setting('app.settings.service_role_key', true), ''),
        '__SERVICE_ROLE_KEY__'
      )
    ),
    body := jsonb_build_object('time', now()::text)
  );
  $$
);

-- Verify
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;
