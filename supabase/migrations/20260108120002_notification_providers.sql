-- Migration: Add notification provider settings and enhance notification_logs table
-- Date: 2026-01-08
-- Description: Adds support for multiple notification providers (Africa's Talking, Twilio, SendGrid, SMTP)
--              for SMS, WhatsApp, and Email notifications

-- Ensure notification_logs table has all required columns
ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS provider_response JSONB DEFAULT '{}'::jsonb;

-- Add index for faster queries on notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- Add comment to notification_logs table
COMMENT ON TABLE notification_logs IS 'Logs all notification attempts (SMS, Email, WhatsApp) sent through the system';
COMMENT ON COLUMN notification_logs.type IS 'Type of notification: sms, email, push, whatsapp';
COMMENT ON COLUMN notification_logs.status IS 'Status: pending, sent, failed, pending_config, disabled';
COMMENT ON COLUMN notification_logs.provider_response IS 'Raw response from the notification provider (Africa''s Talking, Twilio, SendGrid)';

-- Insert default notification provider settings if not exists
INSERT INTO system_settings (key, value, description, created_at, updated_at)
VALUES (
  'notification_providers',
  jsonb_build_object(
    'sms_enabled', false,
    'sms_provider', 'none',
    'africastalking_username', '',
    'africastalking_api_key', '',
    'africastalking_sender_id', 'PHINDU',
    'twilio_account_sid', '',
    'twilio_auth_token', '',
    'twilio_phone_number', '',
    'whatsapp_enabled', false,
    'whatsapp_provider', 'none',
    'africastalking_whatsapp_number', '',
    'twilio_whatsapp_number', '',
    'email_enabled', false,
    'email_provider', 'none',
    'sendgrid_api_key', '',
    'sendgrid_from_email', '',
    'sendgrid_from_name', 'Phindu Finance',
    'smtp_host', '',
    'smtp_port', 587,
    'smtp_username', '',
    'smtp_password', '',
    'smtp_from_email', '',
    'smtp_from_name', 'Phindu Finance',
    'notify_on_signup', true,
    'notify_on_loan_approval', true,
    'notify_on_loan_rejection', true,
    'notify_on_disbursement', true,
    'notify_on_payment_received', true,
    'notify_on_payment_reminder', true,
    'notify_on_overdue', true,
    'notify_on_loan_completion', true
  ),
  'Multi-channel notification provider settings for SMS, WhatsApp, and Email communications',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Create a view for notification statistics
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  type,
  status,
  COUNT(*) as count,
  DATE(created_at) as date
FROM notification_logs
GROUP BY type, status, DATE(created_at)
ORDER BY date DESC, type, status;

COMMENT ON VIEW notification_stats IS 'Daily notification statistics grouped by type and status';

-- Create function to get recent notification logs for a user
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  recipient TEXT,
  title TEXT,
  message TEXT,
  status TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.id,
    nl.type,
    nl.recipient,
    nl.title,
    nl.message,
    nl.status,
    nl.sent_at,
    nl.created_at
  FROM notification_logs nl
  WHERE nl.user_id = p_user_id
  ORDER BY nl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_notifications IS 'Retrieves recent notification logs for a specific user';

-- Create function to get notification delivery rate
CREATE OR REPLACE FUNCTION get_notification_delivery_rate(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  type TEXT,
  total_sent BIGINT,
  successful BIGINT,
  failed BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    nl.type,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE status = 'sent') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'sent')::NUMERIC / NULLIF(COUNT(*), 0) * 100),
      2
    ) as success_rate
  FROM notification_logs nl
  WHERE DATE(nl.created_at) BETWEEN p_start_date AND p_end_date
  GROUP BY nl.type
  ORDER BY nl.type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_notification_delivery_rate IS 'Calculates notification delivery success rates by type for a date range';

-- Grant necessary permissions
GRANT SELECT ON notification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_delivery_rate TO authenticated;
