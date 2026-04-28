-- Update notify_loan_status_change to also write to in-app inbox
CREATE OR REPLACE FUNCTION public.notify_loan_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_email TEXT;
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
  v_contract_url TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_borrower_email := NEW.email;
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    v_contract_url := NEW.contract_url;
    
    -- APPROVED
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      PERFORM create_inbox_notification(
        NEW.user_id,
        'Loan Approved 🎉',
        format('Your loan application for K%s has been approved. Please review and sign your contract.', v_loan_amount::TEXT),
        'success',
        '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id, 'amount', v_loan_amount),
        'loan_application', NEW.id
      );
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Approved',
          format('Congratulations %s! Your loan application for K%s has been APPROVED. Please review and sign your loan contract. Check your email for the contract document. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          format('Loan Approved - K%s', v_loan_amount::TEXT), 'loan_approval'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. Please check your email for the loan contract. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'loan_approval'
        );
      END IF;
    END IF;

    -- CONTRACT SIGNING
    IF NEW.status = 'contract_signing' AND (OLD.status IS NULL OR OLD.status != 'contract_signing') THEN
      PERFORM create_inbox_notification(
        NEW.user_id,
        'Contract Ready to Sign',
        format('Your loan contract for K%s is ready. Please review and sign it to proceed.', v_loan_amount::TEXT),
        'info',
        '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id, 'amount', v_loan_amount, 'contract_url', v_contract_url),
        'loan_application', NEW.id
      );
      IF v_borrower_email IS NOT NULL AND v_contract_url IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Contract Ready',
          format('Dear %s, your loan contract for K%s is ready for signing. Please review the attached contract document and sign it. Contract: %s - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT, v_contract_url),
          format('Loan Contract - K%s', v_loan_amount::TEXT), 'contract_signing'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Contract Ready',
          format('Dear %s, your loan contract for K%s is ready. Please check your email for the contract document to sign. - Phindu Finance', 
                 v_borrower_name, v_loan_amount::TEXT),
          NULL, 'contract_signing'
        );
      END IF;
    END IF;
    
    -- REJECTED
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      PERFORM create_inbox_notification(
        NEW.user_id,
        'Loan Application Update',
        'Your loan application was not approved at this time. Please contact us for more information.',
        'warning',
        '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id),
        'loan_application', NEW.id
      );
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          'Loan Application Update', 'loan_rejection'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Application Update',
          format('Dear %s, please check your email regarding your loan application status. - Phindu Finance', v_borrower_name),
          NULL, 'loan_rejection'
        );
      END IF;
    END IF;
    
    -- COMPLETED
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      PERFORM create_inbox_notification(
        NEW.user_id,
        'Loan Fully Repaid 🎉',
        'Congratulations! You have successfully completed all loan repayments. Your account is now clear.',
        'success',
        '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id),
        'loan_application', NEW.id
      );
      IF v_borrower_email IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'email', v_borrower_email, 'Loan Completed',
          format('Congratulations %s! You have successfully completed all loan repayments. Your account is now clear. Thank you for banking with Phindu Finance!', v_borrower_name),
          'Loan Completed - Congratulations!', 'loan_completion'
        );
      END IF;
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Completed',
          format('Congratulations %s! Your loan has been fully repaid. Check your email for clearance certificate. - Phindu Finance', v_borrower_name),
          NULL, 'loan_completion'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_disbursement to also write to in-app inbox
CREATE OR REPLACE FUNCTION public.notify_disbursement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT la.phone, la.full_name, la.user_id
    INTO v_borrower_phone, v_borrower_name, v_user_id
    FROM loan_applications la WHERE la.id = NEW.loan_id;

    PERFORM create_inbox_notification(
      v_user_id,
      'Funds Disbursed 💸',
      format('K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days.',
             NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
      'success',
      '/dashboard?tab=loans',
      jsonb_build_object('loan_id', NEW.loan_id, 'amount', NEW.amount, 'reference', NEW.transaction_reference),
      'disbursement', NEW.id
    );
    
    IF v_borrower_phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'sms', v_borrower_phone, 'Disbursement Confirmation',
        format('Dear %s, K%s has been disbursed to your account. Ref: %s. Your first repayment will be due in 30 days. - Phindu Finance', 
               v_borrower_name, NEW.amount::TEXT, COALESCE(NEW.transaction_reference, 'N/A')),
        NULL, 'disbursement'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_payment_received to also write to in-app inbox
CREATE OR REPLACE FUNCTION public.notify_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    PERFORM create_inbox_notification(
      v_user_id,
      'Payment Received ✅',
      format('Payment of K%s received. Remaining balance: K%s.',
             NEW.amount::TEXT, v_remaining_balance::TEXT),
      'success',
      '/dashboard?tab=loans',
      jsonb_build_object('loan_id', NEW.loan_id, 'amount', NEW.amount, 'remaining', v_remaining_balance),
      'repayment', NEW.id
    );
    
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
$function$;