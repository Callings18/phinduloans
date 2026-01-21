-- Migration: Automatic notifications, multiple collateral images, and contract template enhancements
-- Date: 2026-01-21
-- Description: 
--  1. Adds database triggers for automatic email/SMS notifications on loan events
--  2. Adds support for multiple collateral images (up to 3+)
--  3. Adds contract_template_files table for DOCX uploads

-- ============================================================================
-- 1. MULTIPLE COLLATERAL IMAGES SUPPORT
-- ============================================================================

-- Add additional collateral image columns to loan_applications
ALTER TABLE loan_applications 
  ADD COLUMN IF NOT EXISTS collateral_image_2_url TEXT,
  ADD COLUMN IF NOT EXISTS collateral_image_3_url TEXT;

COMMENT ON COLUMN loan_applications.collateral_image_2_url IS 'Second collateral image URL';
COMMENT ON COLUMN loan_applications.collateral_image_3_url IS 'Third collateral image URL';

-- Create table for additional collateral images (for dynamic support)
CREATE TABLE IF NOT EXISTS loan_collateral_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collateral_images_loan_id ON loan_collateral_images(loan_application_id);

-- Enable RLS on loan_collateral_images
ALTER TABLE loan_collateral_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for loan_collateral_images
CREATE POLICY "Staff can view collateral images" ON loan_collateral_images
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role) OR
    has_role(auth.uid(), 'credit_officer'::app_role)
  );

CREATE POLICY "Staff can insert collateral images" ON loan_collateral_images
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Staff can update collateral images" ON loan_collateral_images
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'loan_officer'::app_role)
  );

CREATE POLICY "Admins can delete collateral images" ON loan_collateral_images
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role)
  );

COMMENT ON TABLE loan_collateral_images IS 'Stores additional collateral images for loan applications (beyond the first 3)';

-- ============================================================================
-- 2. CONTRACT TEMPLATE DOCX UPLOAD SUPPORT
-- ============================================================================

-- Add file_url column to contract templates (for DOCX uploads)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_templates' AND table_schema = 'public') THEN
    CREATE TABLE contract_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      content TEXT,
      file_url TEXT,
      file_type TEXT DEFAULT 'text' CHECK (file_type IN ('text', 'docx')),
      is_active BOOLEAN DEFAULT false,
      loan_product_id UUID REFERENCES loan_products(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Staff can manage contract templates" ON contract_templates
      FOR ALL USING (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'super_admin'::app_role)
      );
  ELSE
    -- Add columns if table exists
    ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS file_url TEXT;
    ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'text';
  END IF;
END $$;

COMMENT ON COLUMN contract_templates.file_url IS 'URL to uploaded DOCX template file';
COMMENT ON COLUMN contract_templates.file_type IS 'Type of template: text (plain text) or docx (uploaded file)';

-- ============================================================================
-- 3. NOTIFICATION LOGS ENHANCEMENTS
-- ============================================================================

-- Add subject column to notification_logs if it doesn't exist
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add INSERT policy for notification_logs so triggers can insert
DROP POLICY IF EXISTS "System can insert notification logs" ON notification_logs;
CREATE POLICY "System can insert notification logs" ON notification_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 4. AUTOMATIC NOTIFICATION TRIGGERS
-- ============================================================================

-- Function to send notification via edge function
CREATE OR REPLACE FUNCTION send_notification_via_edge_function(
  p_user_id UUID,
  p_type TEXT,
  p_recipient TEXT,
  p_title TEXT,
  p_message TEXT,
  p_subject TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into notification_logs for tracking
  INSERT INTO notification_logs (
    user_id,
    type,
    recipient,
    title,
    message,
    subject,
    status,
    created_at
  ) VALUES (
    p_user_id,
    p_type,
    p_recipient,
    p_title,
    p_message,
    p_subject,
    'pending',
    NOW()
  );
END;
$$;

COMMENT ON FUNCTION send_notification_via_edge_function IS 'Logs notification request for processing by edge function or background job';

-- Function to trigger notification on loan status change
CREATE OR REPLACE FUNCTION notify_loan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get borrower details
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    
    -- Loan Approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly.', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT),
          'loan_approval'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Approved',
            format('Dear %s, your loan application has been APPROVED. Please check your email for details. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_approval'
          );
        END IF;
      ELSIF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'sms',
          v_borrower_phone,
          'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL,
          'loan_approval'
        );
      END IF;
    END IF;
    
    -- Loan Rejected
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update',
          'loan_rejection'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Application Update',
            format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_rejection'
          );
        END IF;
      END IF;
    END IF;
    
    -- Loan Completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id,
          'email',
          v_borrower_email,
          'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!',
          'loan_completion'
        );
        
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id,
            'sms',
            v_borrower_phone,
            'Loan Completed',
            format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
            NULL,
            'loan_completion'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for loan status changes
DROP TRIGGER IF EXISTS trigger_notify_loan_status_change ON loan_applications;
CREATE TRIGGER trigger_notify_loan_status_change
  AFTER UPDATE OF status ON loan_applications
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_loan_status_change();

-- Function to notify on disbursement
CREATE OR REPLACE FUNCTION notify_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT la.email, la.phone, la.full_name, la.user_id
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id,
        'email',
        v_borrower_email,
        'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        format('Loan Disbursed - K%s', NEW.amount::TEXT),
        'disbursement'
      );
      
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id,
          'sms',
          v_borrower_phone,
          'Disbursement Confirmation',
          format('Dear %s, K%s has been disbursed. Please check your email for details. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT),
          NULL,
          'disbursement'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for disbursements
DROP TRIGGER IF EXISTS trigger_notify_disbursement ON disbursements;
CREATE TRIGGER trigger_notify_disbursement
  AFTER UPDATE OF status ON disbursements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION notify_disbursement();

-- Function to notify on payment received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
  v_total_repayment NUMERIC;
  v_total_paid NUMERIC;
  v_remaining_balance NUMERIC;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    SELECT 
      la.email, 
      la.phone, 
      la.full_name, 
      la.user_id,
      la.total_repayment
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id, v_total_repayment
    FROM loan_applications la
    WHERE la.id = NEW.loan_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM loan_repayments 
    WHERE loan_id = NEW.loan_id AND status = 'paid';
    
    v_remaining_balance := GREATEST(0, COALESCE(v_total_repayment, 0) - v_total_paid);
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id,
        'email',
        v_borrower_email,
        'Payment Received',
        format('Dear %s, we have received your payment of K%s. Remaining balance: K%s. Thank you! - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        format('Payment Received - K%s', NEW.amount::TEXT),
        'payment_received'
      );
      
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id,
          'sms',
          v_borrower_phone,
          'Payment Received',
          format('Dear %s, payment of K%s received. Remaining: K%s. Check email for receipt. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
          NULL,
          'payment_received'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON loan_repayments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER UPDATE OF status ON loan_repayments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION notify_payment_received();

COMMENT ON FUNCTION notify_loan_status_change IS 'Automatically sends notifications when loan status changes (approved, rejected, completed)';
COMMENT ON FUNCTION notify_disbursement IS 'Automatically sends notifications when loan is disbursed';
COMMENT ON FUNCTION notify_payment_received IS 'Automatically sends notifications when payment is received';