ALTER TABLE public.ai_agent_findings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_agent_findings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_findings;
  END IF;
END $$;