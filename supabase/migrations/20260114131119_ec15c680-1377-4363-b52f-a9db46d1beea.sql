-- Add Fonnte and Resend provider fields to notification_providers setting
UPDATE system_settings 
SET value = value || jsonb_build_object(
  'fonnte_api_token', '',
  'fonnte_device_id', '',
  'resend_api_key', '',
  'resend_from_email', '',
  'resend_from_name', 'Phindu Finance'
)
WHERE key = 'notification_providers';

-- Create notification templates table
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

-- Enable RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policy using user_roles table (not profiles.role which doesn't exist)
CREATE POLICY "Staff can manage notification templates"
  ON notification_templates FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'loan_officer'::app_role) OR
    has_role(auth.uid(), 'collections_officer'::app_role)
  );

-- Add update trigger for updated_at
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();