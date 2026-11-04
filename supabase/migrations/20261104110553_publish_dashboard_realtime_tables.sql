-- Include financial account events in the staff dashboard Realtime feed.
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts, public.account_transactions;
