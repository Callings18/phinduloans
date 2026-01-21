-- Migration: Notification Queue Processing Enhancements
-- Date: 2026-01-17
-- Description: Adds retry_count column and indexes for notification queue processing

-- Add retry_count column to notification_logs if not exists
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for pending notifications (for queue processor)
CREATE INDEX IF NOT EXISTS idx_notification_logs_pending ON notification_logs(status, created_at) 
  WHERE status = 'pending';

-- Create index for retry processing
CREATE INDEX IF NOT EXISTS idx_notification_logs_retry ON notification_logs(status, retry_count, created_at)
  WHERE status = 'pending' AND retry_count < 3;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_logs_updated_at ON notification_logs;
CREATE TRIGGER trigger_update_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_logs_updated_at();

-- Create function to get notification queue stats
CREATE OR REPLACE FUNCTION get_notification_queue_stats()
RETURNS TABLE (
  pending_count BIGINT,
  failed_count BIGINT,
  sent_today BIGINT,
  avg_retry_count NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'sent' AND DATE(created_at) = CURRENT_DATE) as sent_today,
    ROUND(AVG(retry_count) FILTER (WHERE status = 'pending'), 2) as avg_retry_count
  FROM notification_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_notification_queue_stats IS 'Returns statistics about the notification queue for monitoring';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notification_queue_stats TO authenticated;
