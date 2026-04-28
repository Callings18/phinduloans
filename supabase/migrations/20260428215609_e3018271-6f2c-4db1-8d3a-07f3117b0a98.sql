-- Unschedule old jobs that were sending the anon key (which the function now rejects)
DO $$
BEGIN
  PERFORM cron.unschedule('process-notification-queue-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('payment-reminder-morning');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('payment-reminder-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Reschedule with service-role bearer (stored in Vault would be ideal; using literal here matches existing pattern in codebase)
-- NOTE: This uses the project service role key. The function accepts service role key, cron secret, or admin user JWT.

SELECT cron.schedule(
  'process-notification-queue-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yqrfheavftgybhcafzpt.supabase.co/functions/v1/process-notification-queue',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body:=jsonb_build_object('time', now()::text)
  );
  $$
);
