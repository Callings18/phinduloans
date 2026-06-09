-- 0. Drop the view that depends on loan_applications.email
DROP VIEW IF EXISTS public.overdue_loans_view;

-- 1. Rewrite loan status change notifier to be SMS-only (no email)
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
      PERFORM create_inbox_notification(
        NEW.user_id, 'Loan Application Update',
        'Your loan application was not approved at this time. Please contact us for more information.',
        'warning', '/dashboard?tab=loans',
        jsonb_build_object('loan_id', NEW.id),
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

-- 2. Rewrite payment received notifier to be SMS-only (no email)
CREATE OR REPLACE FUNCTION public.notify_payment_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrower_phone TEXT;
  v_borrower_name TEXT;
  v_user_id UUID;
  v_total_repayment NUMERIC;
  v_total_paid NUMERIC;
  v_remaining_balance NUMERIC;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    SELECT la.phone, la.full_name, la.user_id, la.total_repayment
    INTO v_borrower_phone, v_borrower_name, v_user_id, v_total_repayment
    FROM loan_applications la WHERE la.id = NEW.loan_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM loan_repayments WHERE loan_id = NEW.loan_id AND status = 'paid';

    v_remaining_balance := GREATEST(0, COALESCE(v_total_repayment, 0) - v_total_paid);

    PERFORM create_inbox_notification(
      v_user_id, 'Payment Received ✅',
      format('Payment of K%s received. Remaining balance: K%s.', NEW.amount::TEXT, v_remaining_balance::TEXT),
      'success', '/dashboard?tab=loans',
      jsonb_build_object('loan_id', NEW.loan_id, 'amount', NEW.amount, 'remaining', v_remaining_balance),
      'repayment', NEW.id
    );

    IF v_borrower_phone IS NOT NULL THEN
      PERFORM send_notification_via_edge_function(
        v_user_id, 'sms', v_borrower_phone, 'Payment Received',
        format('Dear %s, payment of K%s received. Remaining balance: K%s. Thank you! - Phindu Finance', v_borrower_name, NEW.amount::TEXT, v_remaining_balance::TEXT),
        NULL, 'payment_received'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Drop email columns from borrower-facing tables (staff email stays on profiles)
ALTER TABLE public.loan_applications DROP COLUMN IF EXISTS email;
ALTER TABLE public.loan_guarantors DROP COLUMN IF EXISTS email;
ALTER TABLE public.employees DROP COLUMN IF EXISTS email;
ALTER TABLE public.employers DROP COLUMN IF EXISTS email;

-- 4. Recreate the overdue loans view without borrower email
CREATE VIEW public.overdue_loans_view WITH (security_invoker = true) AS
 SELECT la.id AS loan_id,
    la.full_name AS borrower_name,
    la.phone AS borrower_phone,
    la.loan_amount,
    la.total_repayment,
    la.status AS loan_status,
    COALESCE((SELECT sum(loan_repayments.amount) FROM loan_repayments
          WHERE loan_repayments.loan_id = la.id AND loan_repayments.status = 'paid'::text), 0::numeric) AS total_paid,
    COALESCE((SELECT count(*) FROM loan_repayments
          WHERE loan_repayments.loan_id = la.id AND loan_repayments.status = 'pending'::text AND loan_repayments.due_date < CURRENT_DATE), 0::bigint) AS overdue_count,
    COALESCE((SELECT sum(loan_repayments.amount + COALESCE(loan_repayments.penalty_amount, 0::numeric)) FROM loan_repayments
          WHERE loan_repayments.loan_id = la.id AND loan_repayments.status = 'pending'::text AND loan_repayments.due_date < CURRENT_DATE), 0::numeric) AS overdue_amount,
    COALESCE((SELECT min(loan_repayments.due_date) FROM loan_repayments
          WHERE loan_repayments.loan_id = la.id AND loan_repayments.status = 'pending'::text AND loan_repayments.due_date < CURRENT_DATE), NULL::date) AS oldest_overdue_date,
    ca.collector_id AS assigned_collector_id,
    ca.priority AS collection_priority,
    ca.last_contact_at,
    ca.next_action_date,
    (SELECT collection_activities.activity_type FROM collection_activities
          WHERE collection_activities.loan_id = la.id ORDER BY collection_activities.created_at DESC LIMIT 1) AS last_activity_type,
    (SELECT collection_activities.created_at FROM collection_activities
          WHERE collection_activities.loan_id = la.id ORDER BY collection_activities.created_at DESC LIMIT 1) AS last_activity_date,
    (SELECT collection_activities.promise_date FROM collection_activities
          WHERE collection_activities.loan_id = la.id AND collection_activities.promise_date IS NOT NULL AND collection_activities.promise_date >= CURRENT_DATE
          ORDER BY collection_activities.created_at DESC LIMIT 1) AS active_ptp_date,
    (SELECT collection_activities.promise_amount FROM collection_activities
          WHERE collection_activities.loan_id = la.id AND collection_activities.promise_date IS NOT NULL AND collection_activities.promise_date >= CURRENT_DATE
          ORDER BY collection_activities.created_at DESC LIMIT 1) AS active_ptp_amount
   FROM loan_applications la
     LEFT JOIN collection_assignments ca ON ca.loan_id = la.id AND ca.status = 'active'::text
  WHERE (la.status = ANY (ARRAY['active'::loan_status, 'disbursed'::loan_status]))
    AND (EXISTS (SELECT 1 FROM loan_repayments
          WHERE loan_repayments.loan_id = la.id AND loan_repayments.status = 'pending'::text AND loan_repayments.due_date < CURRENT_DATE));

GRANT SELECT ON public.overdue_loans_view TO authenticated, anon, service_role;