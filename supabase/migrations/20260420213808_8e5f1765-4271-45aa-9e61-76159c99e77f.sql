-- Enable realtime for additional tables so borrowers/admin get instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.borrower_document_vault;
ALTER PUBLICATION supabase_realtime ADD TABLE public.borrower_kyc_info;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_claims;

-- Ensure full row payloads (so UPDATE diffs include old + new values for status comparisons)
ALTER TABLE public.loan_applications REPLICA IDENTITY FULL;
ALTER TABLE public.notification_logs REPLICA IDENTITY FULL;
ALTER TABLE public.borrower_document_vault REPLICA IDENTITY FULL;