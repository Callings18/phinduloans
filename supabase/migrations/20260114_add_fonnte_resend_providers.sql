-- Migration: Add Fonnte (WhatsApp) and Resend (Email) provider support
-- Date: 2026-01-14
-- Description: Adds budget-friendly notification providers:
--              - Fonnte for WhatsApp (~$6/month unlimited)
--              - Resend for Email (3,000 free/month)

-- Update existing notification_providers settings to include new providers
-- This will update the default values for new deployments
UPDATE system_settings 
SET value = value || jsonb_build_object(
  -- Fonnte WhatsApp provider settings
  'fonnte_api_token', '',
  'fonnte_device_id', '',
  -- Resend Email provider settings
  'resend_api_key', '',
  'resend_from_email', '',
  'resend_from_name', 'Phindu Finance',
  -- Update default providers to budget-friendly options
  'sms_provider', COALESCE(value->>'sms_provider', 'africastalking'),
  'whatsapp_provider', CASE 
    WHEN value->>'whatsapp_provider' = 'none' OR value->>'whatsapp_provider' IS NULL 
    THEN 'fonnte' 
    ELSE value->>'whatsapp_provider' 
  END,
  'email_provider', CASE 
    WHEN value->>'email_provider' = 'none' OR value->>'email_provider' IS NULL 
    THEN 'resend' 
    ELSE value->>'email_provider' 
  END
)
WHERE key = 'notification_providers';

-- Add a comment documenting the available providers
COMMENT ON TABLE system_settings IS 'System-wide configuration settings including notification providers:
  SMS Providers: africastalking (recommended for Africa), twilio
  WhatsApp Providers: fonnte (cheapest ~$6/mo), twilio
  Email Providers: resend (3000 free/mo), sendgrid';

-- Create notification template table for customizable messages
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  sms_template TEXT,
  whatsapp_template TEXT,
  email_subject TEXT,
  email_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for notification_templates
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Staff and admins can read/write templates
CREATE POLICY "Staff can manage notification templates"
  ON notification_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'superadmin', 'loan_officer', 'collections_officer')
    )
  );

-- Insert default notification templates
INSERT INTO notification_templates (event_type, sms_template, whatsapp_template, email_subject, email_template) VALUES
  ('signup', 
   'Welcome to Phindu Finance, {{name}}! Your account has been created successfully.',
   'Welcome to Phindu Finance, {{name}}! 🎉\n\nYour account has been created successfully. You can now apply for loans.',
   'Welcome to Phindu Finance!',
   'Dear {{name}},\n\nWelcome to Phindu Finance! Your account has been created successfully.\n\nYou can now apply for loans and manage your finances with ease.\n\nBest regards,\nPhindu Finance Team'),
  
  ('loan_approval',
   'Congratulations {{name}}! Your loan of K{{amount}} has been APPROVED. Funds will be disbursed shortly.',
   'Congratulations {{name}}! ✅\n\nYour loan application for K{{amount}} has been APPROVED.\n\nFunds will be disbursed shortly.',
   'Loan Approved - K{{amount}}',
   'Dear {{name}},\n\nGreat news! Your loan application for K{{amount}} has been approved.\n\nYour funds will be disbursed shortly.\n\nThank you for choosing Phindu Finance.'),
   
  ('loan_rejection',
   'Dear {{name}}, we regret that your loan application was not approved. Contact us for more info.',
   'Dear {{name}},\n\nWe regret to inform you that your loan application was not approved at this time.\n\n{{reason}}\n\nPlease contact us for more information.',
   'Loan Application Update',
   'Dear {{name}},\n\nWe regret to inform you that your loan application was not approved at this time.\n\n{{reason}}\n\nPlease don''t hesitate to contact us if you have any questions.\n\nBest regards,\nPhindu Finance Team'),
   
  ('disbursement',
   'Dear {{name}}, K{{amount}} has been disbursed to your account. Ref: {{reference}}',
   'Dear {{name}}, 💰\n\nK{{amount}} has been disbursed to your account.\n\nRef: {{reference}}\n\nYour first repayment is due on {{due_date}}.',
   'Loan Disbursed - K{{amount}}',
   'Dear {{name}},\n\nYour loan of K{{amount}} has been disbursed to your account.\n\nReference: {{reference}}\nFirst payment due: {{due_date}}\n\nThank you for choosing Phindu Finance.'),
   
  ('payment_received',
   'Dear {{name}}, payment of K{{amount}} received. Balance: K{{balance}}. Thank you!',
   'Dear {{name}}, 🧾\n\nWe received your payment of K{{amount}}.\n\nRemaining balance: K{{balance}}\n\nThank you!',
   'Payment Received - K{{amount}}',
   'Dear {{name}},\n\nThank you for your payment of K{{amount}}.\n\nYour remaining balance is K{{balance}}.\n\nBest regards,\nPhindu Finance Team'),
   
  ('payment_reminder',
   'Dear {{name}}, reminder: K{{amount}} is due on {{due_date}}. Please pay on time.',
   'Dear {{name}}, ⏰\n\nFriendly reminder: Your payment of K{{amount}} is due on {{due_date}}.\n\nPlease ensure timely payment.',
   'Payment Reminder - Due {{due_date}}',
   'Dear {{name}},\n\nThis is a friendly reminder that your loan payment of K{{amount}} is due on {{due_date}}.\n\nPlease ensure timely payment to avoid penalties.\n\nBest regards,\nPhindu Finance Team'),
   
  ('overdue',
   'Dear {{name}}, your payment of K{{amount}} is {{days}} days overdue. Please pay immediately.',
   'Dear {{name}}, ⚠️\n\nYour payment of K{{amount}} is {{days}} day(s) overdue.\n\nPlease make payment immediately to avoid penalties.',
   'Overdue Payment Notice - {{days}} Days',
   'Dear {{name}},\n\nYour payment of K{{amount}} is now {{days}} day(s) overdue.\n\nPlease make payment immediately to avoid additional penalties.\n\nIf you are experiencing difficulties, please contact us to discuss payment arrangements.\n\nBest regards,\nPhindu Finance Collections'),
   
  ('loan_completion',
   'Congratulations {{name}}! Your loan is fully paid. Thank you for banking with Phindu Finance!',
   'Congratulations {{name}}! 🎉\n\nYou have successfully completed all loan repayments!\n\nThank you for banking with Phindu Finance.',
   'Loan Completed - Congratulations!',
   'Dear {{name}},\n\nCongratulations! You have successfully completed all loan repayments.\n\nYour account is now clear, and you are welcome to apply for a new loan anytime.\n\nThank you for your trust in Phindu Finance.\n\nBest regards,\nPhindu Finance Team')
ON CONFLICT (event_type) DO NOTHING;

-- Create index on notification_templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON notification_templates(event_type);

-- Grant permissions
GRANT SELECT ON notification_templates TO authenticated;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notification_templates_timestamp ON notification_templates;
CREATE TRIGGER update_notification_templates_timestamp
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_templates_updated_at();
