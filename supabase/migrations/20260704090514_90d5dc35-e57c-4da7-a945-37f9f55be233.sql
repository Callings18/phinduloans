-- Additive inbox notifications for events previously SMS/toast-only.

-- 1. Application submitted → inbox (SMS unchanged)
CREATE OR REPLACE FUNCTION public.notify_application_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM create_inbox_notification(
      NEW.user_id,
      'Application received',
      format(
        'Hi %s, your loan application for K%s has been received. We will review it within 24–48 hours.',
        COALESCE(NEW.full_name, 'there'),
        COALESCE(NEW.loan_amount::TEXT, '0')
      ),
      'info',
      '/dashboard?tab=loans',
      jsonb_build_object('loan_id', NEW.id, 'amount', NEW.loan_amount),
      'loan_application',
      NEW.id
    );

    IF NEW.phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        NEW.user_id,
        'sms',
        NEW.phone,
        'Application Received',
        format(
          'Hi %s, your loan application has been received. Ref: %s. We''ll contact you within 24-48 hours. - Phindu Finance',
          COALESCE(NEW.full_name, 'there'),
          LEFT(NEW.id::TEXT, 8)
        ),
        NULL,
        'application_submitted'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Include rejection reason in inbox when loan rejected
CREATE OR REPLACE FUNCTION public.notify_loan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_loan_amount NUMERIC;
  v_contract_url TEXT;
  v_rejection_msg TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_borrower_phone := NEW.phone;
    v_borrower_name := NEW.full_name;
    v_loan_amount := NEW.loan_amount;
    v_contract_url := NEW.contract_url;

    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
      PERFORM create_inbox_notification(
        NEW.user_id, 'Loan Approved 🎉',
        format('Your loan application for K%s has been approved. Please review and sign your contract.', v_loan_amount::TEXT),
        'success', '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id, 'amount', v_loan_amount),
        'loan_application', NEW.id
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Approved',
          format('Congratulations %s! Your loan for K%s has been APPROVED. Please log in to review and sign your loan contract. - Phindu Finance', v_borrower_name, v_loan_amount::TEXT),
          NULL, 'loan_approval'
        );
      END IF;
    END IF;

    IF NEW.status = 'contract_signing' AND (OLD.status IS NULL OR OLD.status != 'contract_signing') THEN
      PERFORM create_inbox_notification(
        NEW.user_id, 'Contract Ready to Sign',
        format('Your loan contract for K%s is ready. Please review and sign it to proceed.', v_loan_amount::TEXT),
        'info', '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id, 'amount', v_loan_amount, 'contract_url', v_contract_url),
        'loan_application', NEW.id
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Contract Ready',
          format('Dear %s, your loan contract for K%s is ready. Please log in to review and sign the contract document. - Phindu Finance', v_borrower_name, v_loan_amount::TEXT),
          NULL, 'contract_signing'
        );
      END IF;
    END IF;

    IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
      v_rejection_msg := COALESCE(NULLIF(TRIM(NEW.rejection_reason), ''), 'Your loan application was not approved at this time. Please contact us for more information.');
      PERFORM create_inbox_notification(
        NEW.user_id, 'Loan Application Update',
        v_rejection_msg,
        'warning', '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id, 'rejection_reason', NEW.rejection_reason),
        'loan_application', NEW.id
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Application Update',
          format('Dear %s, we regret to inform you that your loan application was not approved at this time. Please contact us for more information. - Phindu Finance', v_borrower_name),
          NULL, 'loan_rejection'
        );
      END IF;
    END IF;

    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      PERFORM create_inbox_notification(
        NEW.user_id, 'Loan Fully Repaid 🎉',
        'Congratulations! You have successfully completed all loan repayments. Your account is now clear.',
        'success', '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id),
        'loan_application', NEW.id
      );
      IF v_borrower_phone IS NOT NULL THEN
        PERFORM send_notification_via_edge_function(
          NEW.user_id, 'sms', v_borrower_phone, 'Loan Completed',
          format('Congratulations %s! Your loan has been fully repaid and your account is now clear. Thank you for banking with Phindu Finance. - Phindu Finance', v_borrower_name),
          NULL, 'loan_completion'
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Payment claim review → inbox
CREATE OR REPLACE FUNCTION public.notify_payment_claim_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved', 'verified', 'rejected', 'needs_more_info') THEN
    IF NEW.status IN ('approved', 'verified') THEN
      v_title := 'Payment claim approved';
      v_message := COALESCE(NULLIF(TRIM(NEW.review_comment), ''), 'Your payment has been verified and recorded.');
      v_type := 'success';
    ELSIF NEW.status = 'rejected' THEN
      v_title := 'Payment claim rejected';
      v_message := COALESCE(NULLIF(TRIM(NEW.review_comment), ''), 'Your payment claim was not accepted. Please check the Payments tab.');
      v_type := 'warning';
    ELSE
      v_title := 'More information needed';
      v_message := COALESCE(NULLIF(TRIM(NEW.review_comment), ''), 'Please resubmit your payment claim with the requested details.');
      v_type := 'info';
    END IF;

    PERFORM create_inbox_notification(
      NEW.user_id,
      v_title,
      v_message,
      v_type,
      '/dashboard?tab=payments',
      jsonb_build_object('claim_id', NEW.id, 'repayment_id', NEW.repayment_id, 'status', NEW.status),
      'payment_claim',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment_claim_review ON public.payment_claims;
CREATE TRIGGER trg_notify_payment_claim_review
  AFTER UPDATE ON public.payment_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_claim_review();

-- 4. KYC vault verify/reject → inbox
CREATE OR REPLACE FUNCTION public.notify_borrower_vault_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.is_verified IS DISTINCT FROM NEW.is_verified) AND NEW.is_verified = true THEN
      PERFORM create_inbox_notification(
        NEW.borrower_id,
        'Document verified',
        format('Your %s has been verified.', COALESCE(NEW.doc_label, 'document')),
        'success',
        '/dashboard?tab=profile',
        jsonb_build_object('doc_type', NEW.doc_type),
        'borrower_document_vault',
        NEW.id
      );
    ELSIF NEW.notes IS NOT NULL AND NEW.notes LIKE 'Rejected:%' AND (OLD.notes IS DISTINCT FROM NEW.notes) THEN
      v_message := TRIM(REPLACE(NEW.notes, 'Rejected:', ''));
      PERFORM create_inbox_notification(
        NEW.borrower_id,
        'Document needs attention',
        format('%s: %s', COALESCE(NEW.doc_label, 'A document'), v_message),
        'warning',
        '/dashboard?tab=profile&kyc=documents',
        jsonb_build_object('doc_type', NEW.doc_type),
        'borrower_document_vault',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_borrower_vault_status ON public.borrower_document_vault;
CREATE TRIGGER trg_notify_borrower_vault_status
  AFTER UPDATE ON public.borrower_document_vault
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_borrower_vault_status();