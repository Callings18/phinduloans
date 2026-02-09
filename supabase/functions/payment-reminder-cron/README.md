# Payment Reminder Cron

Finds pending repayments due in the next 1–3 days or overdue, then sends one reminder per loan via `send-due-soon-notification` (SMS/WhatsApp per your notification settings).

## Deploy

```bash
supabase functions deploy payment-reminder-cron
```

## Schedule

Run daily (e.g. 8:00 AM). In Supabase Dashboard → Database → Cron Jobs:

```sql
SELECT cron.schedule(
  'payment-reminder-cron',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_OR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Or use an external cron (GitHub Actions, Vercel Cron, etc.) to POST to the function URL with the appropriate `Authorization` header.
