-- Fix security definer view issue by dropping and recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.overdue_loans_view;

-- Recreate without SECURITY DEFINER (uses SECURITY INVOKER by default)
CREATE VIEW public.overdue_loans_view WITH (security_invoker = true) AS
SELECT 
  la.id as loan_id,
  la.full_name as borrower_name,
  la.phone as borrower_phone,
  la.email as borrower_email,
  la.loan_amount,
  la.total_repayment,
  la.status as loan_status,
  COALESCE(
    (SELECT SUM(amount) FROM public.loan_repayments WHERE loan_id = la.id AND status = 'paid'),
    0
  ) as total_paid,
  COALESCE(
    (SELECT COUNT(*) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_count,
  COALESCE(
    (SELECT SUM(amount + COALESCE(penalty_amount, 0)) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    0
  ) as overdue_amount,
  COALESCE(
    (SELECT MIN(due_date) FROM public.loan_repayments 
     WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE),
    NULL
  ) as oldest_overdue_date,
  ca.collector_id as assigned_collector_id,
  ca.priority as collection_priority,
  ca.last_contact_at,
  ca.next_action_date,
  (SELECT activity_type FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_type,
  (SELECT created_at FROM public.collection_activities 
   WHERE loan_id = la.id ORDER BY created_at DESC LIMIT 1) as last_activity_date,
  (SELECT promise_date FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_date,
  (SELECT promise_amount FROM public.collection_activities 
   WHERE loan_id = la.id AND promise_date IS NOT NULL AND promise_date >= CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as active_ptp_amount
FROM public.loan_applications la
LEFT JOIN public.collection_assignments ca ON ca.loan_id = la.id AND ca.status = 'active'
WHERE la.status IN ('active', 'disbursed')
AND EXISTS (
  SELECT 1 FROM public.loan_repayments 
  WHERE loan_id = la.id AND status = 'pending' AND due_date < CURRENT_DATE
);