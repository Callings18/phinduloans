UPDATE public.notification_logs
SET status = 'cancelled',
    error_message = COALESCE(error_message, '') || ' [Cancelled by admin: backlog cleared, real-time only]',
    updated_at = now()
WHERE status = 'pending';