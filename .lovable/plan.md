# Phindu AI Agents Module — Phase 1 Build

Build an **isolated, observe-only AI Agents module** on top of the existing LMS. Nothing in current borrower/admin/repayment/disbursement/calculation flows changes. Agents only **read** data and **write to their own new tables**. No agent can mutate loans, repayments, balances, or approvals.

First pass scope (your choices): foundations + AI Agents shell + **Guardian AI** and **Senior Engineer AI** fully built; the other 9 agents ship as disabled placeholder rows. Engine = Lovable AI (Gemini). Whole module behind a `feature_flags` killswitch.

## 1. Architecture review — what already exists vs. what's missing

**Already in place (reused, not rebuilt):**
- Domain events → `loan_events` table + `appendLoanEvent()`
- Audit logs → `audit_logs` + `logAuditEvent()`
- Centralized errors → `errorHandler.ts` (+ optional Sentry)
- Notifications engine + queue → `notification_logs` (status-driven) + `process-notification-queue`
- Scheduled jobs → `payment-reminder-cron` pattern (pg_cron)
- RBAC → `user_roles`, `has_role`, `is_staff`, `get_my_permissions`, `feature_flags`

**Missing — required before agents are useful:**
| Missing capability | Why agents need it |
|---|---|
| Agent registry/config | Per-agent enable/disable, scheduling, autonomy level |
| Agent run log | Every observation must be auditable/replayable |
| Findings/insights store | Diagnoses, severities, recommendations to display & track |
| System/error telemetry table | Senior Engineer needs persisted failed requests, exceptions, slow ops (today errors live only in browser memory) |
| Edge-function health logging | Detect failed SMS, broken PDFs, missing docs server-side |

We add these as **new tables only** — no existing schema is altered, no data destroyed.

## 2. Database migrations (Lovable, additive only)

All new tables in `public`, each with GRANTs + RLS (staff read via `is_staff`, writes service-role only). New `app_role` value `ai_agent` (optional, for attribution) added with `ADD VALUE IF NOT EXISTS`.

1. **`ai_agents`** — registry. Fields: `agent_key` (guardian, senior_engineer, …), `name`, `description`, `category`, `is_enabled`, `autonomy_level` (observe|advise|act, default observe), `schedule_cron`, `config` jsonb, timestamps. Seeded with all 11 agents (only Guardian + Senior Engineer enabled).
2. **`ai_agent_runs`** — one row per execution. Fields: `agent_key`, `trigger` (manual|scheduled), `status` (running|success|error), `started_at`, `finished_at`, `summary`, `tokens_used`, `error_message`, `metadata` jsonb.
3. **`ai_agent_findings`** — outputs. Fields: `agent_key`, `run_id`, `title`, `body` (markdown), `severity` (info|low|medium|high|critical), `category`, `entity_type`, `entity_id`, `recommendation`, `status` (open|acknowledged|resolved|dismissed), `acknowledged_by`, timestamps.
4. **`system_telemetry`** — server-side health/error feed for Senior/Junior/DevOps agents. Fields: `source` (edge_fn name, module), `event_type` (error|slow_query|failed_request|missing_document|failed_delivery), `severity`, `message`, `context` jsonb, `created_at`. Indexed on `created_at`, `event_type`.
5. **`feature_flags` seed row** — `ai_agents_enabled` (category "AI", default enabled) for the runtime killswitch.
6. **`permissions` + `role_permissions` seed** — module `ai_agents`, actions `view` / `manage`; mapped to admin/super_admin (and any staff you choose later).

Migrations are presented as separate, named SQL files so you review each before it runs.

## 3. Edge functions (server-side AI + collection)

- **`ai-agent-run`** — core executor. Input: `{ agent_key }`. Verifies staff JWT, checks agent `is_enabled` + module flag, gathers **read-only** platform data for that agent via parameterized queries, sends a structured prompt to Lovable AI Gateway (`google/gemini-3-flash-preview`) using the AI SDK gateway helper, writes a `ai_agent_runs` row and resulting `ai_agent_findings`. Hard rule baked in: prompt + code never call any mutating RPC.
- **`ai-copilot`** (Phase 13 groundwork, optional this pass) — staff Q&A endpoint that answers from the same read-only data + recent findings. Can be deferred.
- **`telemetry-ingest`** helper used by existing edge functions to log failures into `system_telemetry` (lightweight insert; wired into notification/PDF/doc paths incrementally).

Guardian and Senior Engineer get dedicated prompt builders + data collectors:
- **Guardian** reads portfolio KPIs (active loans, PAR, due today, overdue, collections rate, cashflow) → daily briefing + executive summary + recommendations.
- **Senior Engineer** reads `system_telemetry`, recent failed `notification_logs`, missing-document checks, slow-query signals → diagnosis + suggested fix + severity; criticals flagged `high/critical` for escalation.

`LOVABLE_API_KEY` is provisioned automatically; never exposed to the browser. 429/402 errors surfaced in UI.

## 4. Frontend module (isolated)

New admin area under `/admin/ai-agents`, gated by `feature_flags.ai_agents_enabled` and `PermissionRoute permission={{module:"ai_agents", action:"view"}}`:
- **`AdminAIAgents.tsx`** — grid of agent cards (status, last run, enable/disable toggle, "Run now").
- **`AdminAIAgentDetail.tsx`** — `/admin/ai-agents/:agentKey` — run history + findings feed (severity badges, acknowledge/dismiss), markdown rendering of summaries.
- New sidebar group **"AI Agents"** in `adminSidebarConfig.ts` with `betaKey`/flag gating.
- Hooks `useAIAgents`, `useAgentRuns`, `useAgentFindings` (React Query). Disabled agents render as "Coming soon" placeholders.

Routing follows the existing `App.tsx` admin pattern exactly. Brand styling (burgundy, Outfit, semantic tokens) reused.

## 5. Safety rules (enforced, not aspirational)

- Agents are **observe-only** (`autonomy_level = observe`); the executor has no code path to mutate loans, repayments, balances, approvals, or deletions.
- All agent writes confined to the 4 new agent/telemetry tables.
- RLS: staff read findings; only service-role (edge functions) writes runs/findings/telemetry.
- Every run + finding is auditable; module can be killed instantly via the feature flag.

## 6. Roadmap (after this pass)

1. **Now:** foundations + Guardian + Senior Engineer (this plan).
2. Next: QA Engineer, Junior Engineer (consume `system_telemetry`).
3. Then: Fraud, Collections, Portfolio Analyst, Compliance (read-only analytics).
4. Then: Architect + DevOps (schema/index/capacity analysis).
5. Then: AI Copilot chat interface (Phase 13).
6. Later, only with explicit per-agent authorization: graduate selected agents from `observe` → `advise` → `act`.

## Technical notes

- Stack is the classic Lovable/Supabase app; AI runs in Supabase edge functions via the Lovable AI Gateway provider helper (AI SDK `generateText` + `Output` for structured findings).
- Scheduling reuses the `payment-reminder-cron` + pg_cron approach to invoke `ai-agent-run` per enabled agent (e.g. Guardian daily briefing at 07:00).
- No changes to `loan_applications`, `loan_repayments`, `disbursements`, calculation utils, or borrower flows.
