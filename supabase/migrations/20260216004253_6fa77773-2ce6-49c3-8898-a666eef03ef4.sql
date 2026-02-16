
-- Update disbursement trigger to SMS only
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

-- Update loan status change trigger: on approval send SMS + Email + contract
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
    
    -- APPROVED: SMS + Email + Contract
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
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

    -- CONTRACT SIGNING: Send contract document via Email + SMS
    IF NEW.status = 'contract_signing' AND (OLD.status IS NULL OR OLD.status != 'contract_signing') THEN
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
    
    -- REJECTED: Email + SMS
    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
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
    
    -- COMPLETED: Email + SMS
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
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
