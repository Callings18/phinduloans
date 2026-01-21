# Notification Queue Processor

This edge function processes pending notifications from the `notification_logs` table.

## Setup

### 1. Deploy the Function
```bash
supabase functions deploy process-notification-queue
```

### 2. Set up Cron Job (Supabase Cron or External)

#### Option A: Supabase Cron (Recommended)
Add to your Supabase dashboard under Database → Cron Jobs:

```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'process-notification-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

#### Option B: External Cron Service
Use a service like:
- GitHub Actions (scheduled workflows)
- Vercel Cron Jobs
- AWS EventBridge
- Google Cloud Scheduler

Example GitHub Actions workflow:
```yaml
name: Process Notification Queue
on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes
jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-notification-queue
```

## Features

- Processes up to 50 pending notifications per run
- Automatic retry with exponential backoff (max 3 retries)
- Marks notifications as failed after max retries
- Handles rate limiting with delays between notifications
- Supports all notification types (SMS, Email, WhatsApp)

## Monitoring

Use the `get_notification_queue_stats()` function to monitor queue health:

```sql
SELECT * FROM get_notification_queue_stats();
```
