-- Fix security warnings: Set search_path on functions

-- Fix send_notification_via_edge_function
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
SET search_path = public
AS $$
BEGIN
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

-- Fix notify_loan_status_change
CREATE OR REPLACE FUNCTION notify_loan_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Funds will be disbursed shortly.', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT), 'loan_approval'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
            format('Dear %s, your loan application has been APPROVED. Please check your email for details. - Phindu Finance', v_borrower_name),
            NULL, 'loan_approval'
          );
        END IF;
      ELSIF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'loan_approval'
        );
      END IF;
    END IF;
    
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update', 'loan_rejection'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Application Update',
            format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
            NULL, 'loan_rejection'
          );
        END IF;
      END IF;
    END IF;
    
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!', 'loan_completion'
        );
        IF v_borrower_phone IS NOT NULL THEN
          PERFORM send_notification_via_edge_function(
            NEW.user_id, 'sms', v_borrower_phone, 'Loan Completed',
            format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
            NULL, 'loan_completion'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_disbursement
CREATE OR REPLACE FUNCTION notify_disbursement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    FROM loan_applications la WHERE la.id = NEW.loan_id;
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'email', v_borrower_email, 'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        format('Loan Disbursed - K%s', NEW.amount::TEXT), 'disbursement'
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id, 'sms', v_borrower_phone, 'Disbursement Confirmation',
          format('Dear %s, K%s has been disbursed. Please check your email for details. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT),
          NULL, 'disbursement'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix notify_payment_received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT la.email, la.phone, la.full_name, la.user_id, la.total_repayment
    INTO v_borrower_email, v_borrower_phone, v_borrower_name, v_user_id, v_total_repayment
    FROM loan_applications la WHERE la.id = NEW.loan_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM loan_repayments WHERE loan_id = NEW.loan_id AND status = 'paid';
    
    v_remaining_balance := GREATEST(0, COALESCE(v_total_repayment, 0) - v_total_paid);
    
    IF v_borrower_email IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'email', v_borrower_email, 'Payment Received',
        format('Dear %s, we have received your payment of K%s. Remaining balance: K%s. Thank you! - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        format('Payment Received - K%s', NEW.amount::TEXT), 'payment_received'
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          v_user_id, 'sms', v_borrower_phone, 'Payment Received',
          format('Dear %s, payment of K%s received. Remaining: K%s. Check email for receipt. - Phindu Finance', 
                 v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
          NULL, 'payment_received'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;