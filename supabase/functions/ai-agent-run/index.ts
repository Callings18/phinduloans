import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function chatCompletionsUrl() {
  const raw = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  return raw.endsWith("/chat/completions") ? raw : `${raw}/chat/completions`;
}
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

type Severity = "info" | "low" | "medium" | "high" | "critical";

interface AgentFinding {
  title: string;
  body: string;
  severity: Severity;
  category?: string;
  recommendation?: string;
}

interface AgentResult {
  summary: string;
  findings: AgentFinding[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────
// Read-only data collectors (NEVER mutate platform data)
// ─────────────────────────────────────────────────────────
async function collectGuardianData(supabase: ReturnType<typeof createClient>) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const win30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [activeLoans, allLoans, schedule, recentReps, recentDisb] = await Promise.all([
    supabase.from("loan_applications").select("id, status").eq("status", "active"),
    supabase.from("loan_applications").select("id, status"),
    // Outstanding & overdue are derived from the unpaid repayment schedule.
    supabase.from("loan_repayments").select("amount, status, due_date").neq("status", "paid").eq("is_reversed", false),
    // Collection rate over the last 30 days of scheduled installments.
    supabase.from("loan_repayments").select("amount, status, due_date").gte("due_date", win30).lte("due_date", todayIso).eq("is_reversed", false),
    supabase.from("disbursements").select("id, amount, status, created_at").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
  ]);

  const active = activeLoans.data ?? [];
  const unpaid = schedule.data ?? [];
  const overdue = unpaid.filter((r: any) => r.due_date < todayIso);
  const dueToday = unpaid.filter((r: any) => r.due_date === todayIso);
  const due30 = recentReps.data ?? [];
  const paid30 = due30.filter((r: any) => r.status === "paid");
  const outstanding = unpaid.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const overdueAmount = overdue.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  return {
    as_of: todayIso,
    active_loans: active.length,
    total_loans: (allLoans.data ?? []).length,
    total_outstanding: Math.round(outstanding),
    due_today_count: dueToday.length,
    overdue_count: overdue.length,
    overdue_amount: Math.round(overdueAmount),
    par_ratio: outstanding > 0 ? Number((overdueAmount / outstanding).toFixed(3)) : 0,
    collection_rate_30d: due30.length > 0 ? Number((paid30.length / due30.length).toFixed(3)) : null,
    disbursements_7d: (recentDisb.data ?? []).length,
    disbursed_amount_7d: Math.round((recentDisb.data ?? []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0)),
  };
}

async function collectSeniorEngineerData(supabase: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  const [telemetry, failedNotifs, recentRuns] = await Promise.all([
    supabase.from("system_telemetry").select("source, event_type, severity, message, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    supabase.from("notification_logs").select("id, type, status, error_message, created_at").eq("status", "failed").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_agent_runs").select("agent_key, status, error_message, created_at").eq("status", "error").gte("created_at", since).limit(20),
  ]);

  const tel = telemetry.data ?? [];
  const counts: Record<string, number> = {};
  for (const t of tel as any[]) counts[t.event_type] = (counts[t.event_type] || 0) + 1;

  return {
    window: "last_7_days",
    telemetry_total: tel.length,
    telemetry_by_type: counts,
    telemetry_samples: (tel as any[]).slice(0, 25),
    failed_notifications: (failedNotifs.data ?? []).length,
    failed_notification_samples: (failedNotifs.data ?? []).slice(0, 15),
    failed_agent_runs: (recentRuns.data ?? []).length,
  };
}

const AGENT_PROMPTS: Record<string, { system: string; build: (d: unknown) => string }> = {
  guardian: {
    system:
      "You are Guardian AI, the operations brain of the Phindu micro-lending platform in Zambia. You OBSERVE ONLY — never recommend changing balances, approving loans, or modifying records automatically. Produce a concise executive daily briefing and concrete, prioritised recommendations for human staff. Amounts are in ZMW.",
    build: (d) =>
      `Here is today's portfolio snapshot (JSON):\n${JSON.stringify(d, null, 2)}\n\nWrite an executive daily briefing and identify the most important issues as findings.`,
  },
  senior_engineer: {
    system:
      "You are Senior Engineer AI for the Phindu lending platform. You watch backend reliability: APIs, repayment engine, PDF generation, document storage, notifications and database integrity. You OBSERVE ONLY and never modify production data. For each detected problem give a diagnosis, a suggested fix, and an honest severity. Mark anything affecting money movement or data integrity as high or critical.",
    build: (d) =>
      `Here is the last 7 days of system telemetry and failures (JSON):\n${JSON.stringify(d, null, 2)}\n\nDiagnose reliability issues. If there are no signals, say so with an 'info' finding rather than inventing problems.`,
  },
};

async function runAgentLLM(agentKey: string, data: unknown, apiKey: string): Promise<AgentResult> {
  const prompt = AGENT_PROMPTS[agentKey];
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.build(data) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "report",
          description: "Return the agent briefing summary and a list of findings.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Markdown executive summary / briefing." },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    body: { type: "string", description: "Markdown detail / diagnosis." },
                    severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
                    category: { type: "string" },
                    recommendation: { type: "string" },
                  },
                  required: ["title", "body", "severity"],
                },
              },
            },
            required: ["summary", "findings"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "report" } },
  };

  const resp = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (resp.status === 429) throw new Error("RATE_LIMIT");
  if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${txt.slice(0, 500)}`);
  }

  const payload = await resp.json();
  const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
  if (call?.function?.arguments) {
    const parsed = JSON.parse(call.function.arguments);
    return { summary: parsed.summary ?? "", findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
  }
  const content = payload?.choices?.[0]?.message?.content ?? "No output produced.";
  return { summary: content, findings: [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY is not configured in Edge Function secrets" }, 500);

    // ── Auth: require an authenticated staff user ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: isStaff } = await userClient.rpc("is_staff", { _user_id: userData.user.id });
    if (!isStaff) return json({ error: "Forbidden — staff only" }, 403);

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Validate input ──
    const bodyJson = await req.json().catch(() => ({}));
    const agentKey = String(bodyJson?.agent_key ?? "");
    const trigger = bodyJson?.trigger === "scheduled" ? "scheduled" : "manual";
    if (!AGENT_PROMPTS[agentKey]) {
      return json({ error: `Unsupported or not-yet-implemented agent: ${agentKey}` }, 400);
    }

    // ── Module killswitch ──
    const { data: flag } = await supabase.from("feature_flags").select("is_enabled").eq("flag_key", "ai_agents_enabled").maybeSingle();
    if (flag && flag.is_enabled === false) return json({ error: "AI Agents module is disabled" }, 403);

    // ── Agent enabled? ──
    const { data: agent } = await supabase.from("ai_agents").select("agent_key, is_enabled").eq("agent_key", agentKey).maybeSingle();
    if (!agent) return json({ error: "Agent not found" }, 404);
    if (!agent.is_enabled) return json({ error: "Agent is disabled" }, 403);

    // ── Start run ──
    const { data: run, error: runErr } = await supabase
      .from("ai_agent_runs")
      .insert({ agent_key: agentKey, trigger, status: "running", triggered_by: userData.user.id })
      .select("id")
      .single();
    if (runErr || !run) return json({ error: "Failed to create run", details: runErr?.message }, 500);

    try {
      // ── Collect read-only data ──
      const data =
        agentKey === "guardian"
          ? await collectGuardianData(supabase)
          : await collectSeniorEngineerData(supabase);

      // ── Run AI ──
      const result = await runAgentLLM(agentKey, data, apiKey);

      // ── Persist findings ──
      if (result.findings.length > 0) {
        await supabase.from("ai_agent_findings").insert(
          result.findings.map((f) => ({
            agent_key: agentKey,
            run_id: run.id,
            title: f.title?.slice(0, 300) ?? "Finding",
            body: f.body ?? null,
            severity: ["info", "low", "medium", "high", "critical"].includes(f.severity) ? f.severity : "info",
            category: f.category ?? null,
            recommendation: f.recommendation ?? null,
          }))
        );
      }

      await supabase
        .from("ai_agent_runs")
        .update({ status: "success", summary: result.summary, finished_at: new Date().toISOString(), metadata: { data_snapshot: data } })
        .eq("id", run.id);

      await supabase.from("ai_agents").update({ last_run_at: new Date().toISOString() }).eq("agent_key", agentKey);

      return json({ success: true, run_id: run.id, summary: result.summary, findings_count: result.findings.length });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      await supabase
        .from("ai_agent_runs")
        .update({ status: "error", error_message: msg, finished_at: new Date().toISOString() })
        .eq("id", run.id);

      if (msg === "RATE_LIMIT") return json({ error: "AI rate limit reached. Please try again shortly." }, 429);
      if (msg === "CREDITS_EXHAUSTED") return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
      return json({ error: "Agent run failed", details: msg }, 500);
    }
  } catch (error: any) {
    return json({ error: "Internal server error", details: error?.message ?? String(error) }, 500);
  }
});
