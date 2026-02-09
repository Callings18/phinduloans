-- Migration: Twilio Notification Enhancements
-- Date: 2026-01-26
-- Description: Adds new notification event triggers and Twilio-specific settings
--              for comprehensive notification system

-- ============================================================================
-- 1. UPDATE SYSTEM SETTINGS WITH NEW EVENT TRIGGERS
-- ============================================================================

-- Update the notification_providers settings to include new event triggers
-- This uses a merge approach to add new fields without overwriting existing ones
UPDATE system_settings
SET 
  value = value || jsonb_build_object(
    -- Twilio specific settings
    'twilio_messaging_service_sid', COALESCE((value->>'twilio_messaging_service_sid'), ''),
    
    -- New Account & Application triggers
    'notify_on_application_submitted', COALESCE((value->>'notify_on_application_submitted')::boolean, true),
    'notify_on_application_under_review', COALESCE((value->>'notify_on_application_under_review')::boolean, true),
    'notify_on_kyc_verification', COALESCE((value->>'notify_on_kyc_verification')::boolean, true),
    'notify_on_document_request', COALESCE((value->>'notify_on_document_request')::boolean, true),
    
    -- New Loan Status triggers
    'notify_on_loan_restructured', COALESCE((value->>'notify_on_loan_restructured')::boolean, true),
    'notify_on_contract_sent', COALESCE((value->>'notify_on_contract_sent')::boolean, true),
    
    -- New Payment triggers
    'notify_on_partial_payment', COALESCE((value->>'notify_on_partial_payment')::boolean, true),
    'notify_on_collection_escalation', COALESCE((value->>'notify_on_collection_escalation')::boolean, true),
    'notify_on_court_case', COALESCE((value->>'notify_on_court_case')::boolean, true),
    
    -- New Other triggers
    'notify_on_statement_available', COALESCE((value->>'notify_on_statement_available')::boolean, true),
    'notify_on_promotion', COALESCE((value->>'notify_on_promotion')::boolean, false)
  ),
  updated_at = NOW()
WHERE key = 'notification_providers';

-- Insert default if not exists (for fresh installations)
INSERT INTO system_settings (key, value, description, created_at, updated_at)
VALUES (
  'notification_providers',
  jsonb_build_object(
    -- Channel enablement
    'sms_enabled', false,
    'whatsapp_enabled', false,
    'email_enabled', false,
    
    -- Twilio Settings (primary provider)
    'twilio_account_sid', '',
    'twilio_auth_token', '',
    'twilio_phone_number', '',
    'twilio_whatsapp_number', '',
    'twilio_messaging_service_sid', '',
    
    -- SendGrid (Twilio Email)
    'sendgrid_api_key', '',
    'sendgrid_from_email', '',
    'sendgrid_from_name', 'Phindu Finance',
    
    -- Account & Application Events
    'notify_on_signup', true,
    'notify_on_application_submitted', true,
    'notify_on_application_under_review', true,
    'notify_on_kyc_verification', true,
    'notify_on_document_request', true,
    
    -- Loan Status Events
    'notify_on_loan_approval', true,
    'notify_on_loan_rejection', true,
    'notify_on_disbursement', true,
    'notify_on_loan_restructured', true,
    'notify_on_loan_completion', true,
    'notify_on_contract_sent', true,
    
    -- Payment Events
    'notify_on_payment_received', true,
    'notify_on_partial_payment', true,
    'notify_on_payment_reminder', true,
    'notify_on_overdue', true,
    'notify_on_collection_escalation', true,
    'notify_on_court_case', true,
    
    -- Other Events
    'notify_on_statement_available', true,
    'notify_on_promotion', false
  ),
  'Twilio notification settings for SMS, WhatsApp (via Twilio), and Email (via SendGrid)',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. ADD SUBJECT COLUMN TO NOTIFICATION_LOGS IF NOT EXISTS
-- ============================================================================

ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS subject TEXT;

COMMENT ON COLUMN notification_logs.subject IS 'Email subject line (for email notifications)';

-- ============================================================================
-- 3. ADD EVENT_TYPE COLUMN TO NOTIFICATION_LOGS FOR BETTER TRACKING
-- ============================================================================

ALTER TABLE notification_logs 
  ADD COLUMN IF NOT EXISTS event_type TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON notification_logs(event_type);

COMMENT ON COLUMN notification_logs.event_type IS 'The event that triggered this notification (e.g., loan_approval, payment_received)';

-- ============================================================================
-- 4. CREATE NOTIFICATION TRIGGER FOR APPLICATION SUBMISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_application_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send notification for new application
  IF TG_OP = 'INSERT' THEN
    -- Email notification
    IF NEW.email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        NEW.user_id,
        'email',
        NEW.email,
        'Application Received',
        format('Hi %s, your loan application (Ref: %s) has been received. We''ll review it and get back to you within 24-48 hours. - Phindu Finance', 
               NEW.full_name, LEFT(NEW.id::TEXT, 8)),
        format('Loan Application Received - Ref: %s', LEFT(NEW.id::TEXT, 8)),
        'application_submitted'
      );
    END IF;
    
    -- SMS notification
    IF NEW.phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        NEW.user_id,
        'sms',
        NEW.phone,
        'Application Received',
        format('Hi %s, your loan application has been received. Ref: %s. We''ll contact you within 24-48 hours. - Phindu Finance', 
               NEW.full_name, LEFT(NEW.id::TEXT, 8)),
        NULL,
        'application_submitted'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new applications
DROP TRIGGER IF EXISTS trigger_notify_application_submitted ON loan_applications;
CREATE TRIGGER trigger_notify_application_submitted
  AFTER INSERT ON loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_application_submitted();

COMMENT ON FUNCTION notify_application_submitted IS 'Automatically sends confirmation when a new loan application is submitted';

-- ============================================================================
-- 5. CREATE NOTIFICATION TRIGGER FOR COURT CASES
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_court_case_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  -- Get loan details
  SELECT la.user_id, la.email, la.phone, la.full_name, la.total_repayment
  INTO v_loan
  FROM loan_applications la
  WHERE la.id = NEW.loan_id;
  
  -- Email notification
  IF v_loan.email IS NOT NULL THEN
    PERFORM send_notification_via_edge_function(
      v_loan.user_id,
      'email',
      v_loan.email,
      'Legal Notice',
      format('LEGAL NOTICE: Dear %s, due to non-payment, legal proceedings have been initiated. Case Number: %s. Please contact our legal department immediately. - Phindu Finance Legal', 
             v_loan.full_name, NEW.case_number),
      format('LEGAL NOTICE - Case %s', NEW.case_number),
      'court_case'
    );
  END IF;
  
  -- SMS notification
  IF v_loan.phone IS NOT NULL THEN
    PERFORM send_notification_via_edge_function(
      v_loan.user_id,
      'sms',
      v_loan.phone,
      'Legal Notice',
      format('LEGAL NOTICE: Dear %s, legal proceedings initiated. Case: %s. Contact us immediately. - Phindu Finance Legal', 
             v_loan.full_name, NEW.case_number),
      NULL,
      'court_case'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for court cases (only if court_cases table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'court_cases') THEN
    DROP TRIGGER IF EXISTS trigger_notify_court_case_created ON court_cases;
    CREATE TRIGGER trigger_notify_court_case_created
      AFTER INSERT ON court_cases
      FOR EACH ROW
      EXECUTE FUNCTION notify_court_case_created();
  END IF;
END;
$$;

COMMENT ON FUNCTION notify_court_case_created IS 'Automatically sends notification when a court case is created';

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

-- Ensure authenticated users can read notification stats
GRANT SELECT ON notification_stats TO authenticated;

-- Update comment on notification_logs table
COMMENT ON TABLE notification_logs IS 'Logs all notification attempts via Twilio (SMS, WhatsApp) and SendGrid (Email)';
