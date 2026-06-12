-- =========================================================
-- AI AGENTS MODULE — additive foundation
-- =========================================================

-- Optional attribution role for agent-performed actions
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ai_agent';

-- ---------------------------------------------------------
-- 1) ai_agents — registry / config
-- ---------------------------------------------------------
CREATE TABLE public.ai_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'operations',
  is_enabled boolean NOT NULL DEFAULT false,
  autonomy_level text NOT NULL DEFAULT 'observe',
  schedule_cron text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agents_autonomy_chk CHECK (autonomy_level IN ('observe','advise','act'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage agents"
  ON public.ai_agents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- 2) ai_agent_runs — execution log
-- ---------------------------------------------------------
CREATE TABLE public.ai_agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key text NOT NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  summary text,
  tokens_used integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_runs_status_chk CHECK (status IN ('running','success','error')),
  CONSTRAINT ai_agent_runs_trigger_chk CHECK (trigger IN ('manual','scheduled'))
);

CREATE INDEX idx_ai_agent_runs_agent_key_created ON public.ai_agent_runs (agent_key, created_at DESC);

GRANT SELECT ON public.ai_agent_runs TO authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view agent runs"
  ON public.ai_agent_runs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------
-- 3) ai_agent_findings — outputs / insights
-- ---------------------------------------------------------
CREATE TABLE public.ai_agent_findings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key text NOT NULL,
  run_id uuid REFERENCES public.ai_agent_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  category text,
  entity_type text,
  entity_id text,
  recommendation text,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_findings_severity_chk CHECK (severity IN ('info','low','medium','high','critical')),
  CONSTRAINT ai_agent_findings_status_chk CHECK (status IN ('open','acknowledged','resolved','dismissed'))
);

CREATE INDEX idx_ai_agent_findings_agent_key_created ON public.ai_agent_findings (agent_key, created_at DESC);
CREATE INDEX idx_ai_agent_findings_status ON public.ai_agent_findings (status);

GRANT SELECT, UPDATE ON public.ai_agent_findings TO authenticated;
GRANT ALL ON public.ai_agent_findings TO service_role;

ALTER TABLE public.ai_agent_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view findings"
  ON public.ai_agent_findings FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update finding status"
  ON public.ai_agent_findings FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ---------------------------------------------------------
-- 4) system_telemetry — server-side health feed
-- ---------------------------------------------------------
CREATE TABLE public.system_telemetry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_telemetry_severity_chk CHECK (severity IN ('info','low','medium','high','critical'))
);

CREATE INDEX idx_system_telemetry_created ON public.system_telemetry (created_at DESC);
CREATE INDEX idx_system_telemetry_event_type ON public.system_telemetry (event_type);

GRANT SELECT ON public.system_telemetry TO authenticated;
GRANT ALL ON public.system_telemetry TO service_role;

ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view telemetry"
  ON public.system_telemetry FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- ---------------------------------------------------------
-- updated_at triggers (reuse existing helper)
-- ---------------------------------------------------------
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_agent_findings_updated_at
  BEFORE UPDATE ON public.ai_agent_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- 5) Seed agent registry (all 11; only guardian + senior_engineer enabled)
-- ---------------------------------------------------------
INSERT INTO public.ai_agents (agent_key, name, description, category, is_enabled, autonomy_level, schedule_cron) VALUES
  ('guardian',        'Guardian AI',         'Operations brain: daily briefings, portfolio/collections/cashflow monitoring, risk detection, executive summaries and recommendations.', 'operations', true,  'observe', '0 7 * * *'),
  ('senior_engineer', 'Senior Engineer AI',  'Software reliability: watches services, APIs, repayment engine, PDFs, documents, notifications and DB integrity; diagnoses issues with severity and suggested fixes.', 'engineering', true, 'observe', NULL),
  ('junior_engineer', 'Junior Engineer AI',  'Handles small operational issues like PDF/report failures, missing images and failed SMS; investigates and suggests fixes.', 'engineering', false, 'observe', NULL),
  ('qa_engineer',     'QA Engineer AI',      'Continuously checks core borrower and loan flows and detects regressions.', 'engineering', false, 'observe', NULL),
  ('architect',       'Architect AI',        'Analyzes technical debt, slow queries, missing indexes, complexity and scalability.', 'engineering', false, 'observe', NULL),
  ('devops',          'DevOps AI',           'Monitors database health, storage, API performance, failed jobs and queues; predicts capacity issues.', 'engineering', false, 'observe', NULL),
  ('fraud',           'Fraud Detection AI',  'Detects duplicate NRCs, device abuse, suspicious applications and high-risk patterns; assigns risk scores.', 'risk', false, 'observe', NULL),
  ('collections',     'Collections AI',      'Monitors due loans, missed repayments and escalation stages; recommends actions.', 'collections', false, 'observe', NULL),
  ('portfolio_analyst','Portfolio Analyst AI','Analyzes product performance, default trends, branch performance and collection rates.', 'analytics', false, 'observe', NULL),
  ('compliance',      'Compliance AI',       'Monitors audit logs, unauthorized actions and role violations; generates alerts.', 'compliance', false, 'observe', NULL),
  ('loan_officer',    'Loan Officer AI',     'Assists with application review and origination insights.', 'lending', false, 'observe', NULL)
ON CONFLICT (agent_key) DO NOTHING;

-- ---------------------------------------------------------
-- 6) Feature flag killswitch
-- ---------------------------------------------------------
INSERT INTO public.feature_flags (flag_key, flag_label, description, is_enabled, category) VALUES
  ('ai_agents_enabled', 'AI Agents Module', 'Master switch for the AI Agents module (Guardian, Senior Engineer, etc.).', true, 'AI')
ON CONFLICT (flag_key) DO NOTHING;

-- ---------------------------------------------------------
-- 7) Permissions + mapping to admin / super_admin
-- ---------------------------------------------------------
INSERT INTO public.permissions (module, action, description) VALUES
  ('ai_agents', 'view',   'View AI Agents module, runs and findings'),
  ('ai_agents', 'manage', 'Enable/disable agents, run agents, manage findings')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_id)
SELECT r.role_name, p.id
FROM (VALUES ('admin'), ('super_admin')) AS r(role_name)
CROSS JOIN public.permissions p
WHERE p.module = 'ai_agents'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- 8) SECURITY FIX — explicit service-role-only read on otp_codes
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Service role can read otp codes" ON public.otp_codes;
CREATE POLICY "Service role can read otp codes"
  ON public.otp_codes FOR SELECT
  TO service_role
  USING (true);