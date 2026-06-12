// Phindu AI Copilot — multi-agent conversational assistant at the user's fingertips.
//
// Supports three personas in one streaming endpoint:
//   • phindu          → friendly general assistant (guide / explainer)
//   • guardian        → Guardian AI, the operations brain (read-only portfolio insight)
//   • senior_engineer → Senior Engineer AI, backend reliability watchdog (read-only)
//
// Guardian & Senior Engineer require an authenticated STAFF user and are given
// live (read-only) platform context. They NEVER mutate data — they only advise.
// Multimodal: messages may include image_url / file (PDF) / inline text blocks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

type AgentKey = "phindu" | "guardian" | "senior_engineer";

const SYSTEM_PROMPTS: Record<AgentKey, string> = {
  phindu: `You are "Phindu Assistant", a warm, upbeat AI helper embedded in the Phindu Loan Management Platform (a Zambian micro-lending system).

Personality: friendly, concise, encouraging, professional.
You are a guide and explainer, NOT an operator. You CANNOT approve loans, change repayments, disburse funds, or modify any records. If asked, politely explain the user must do that through the proper screen, and point them there.
You help with: explaining features (loans, repayments, disbursements, KYC, payroll, reports, collections), finding the right page, lending concepts, Zambian context (NRC, NAPSA, NHIMA, PAYE), drafting messages and summaries.
If the user attaches an image, PDF, or file, read it and help with it.
Style: short, skimmable, markdown when helpful. Never invent figures or claim to have performed an action.`,

  guardian: `You are "Guardian AI", the operations brain of the Phindu micro-lending platform in Zambia. You are talking directly to a staff member.
You OBSERVE and ADVISE ONLY — you never change balances, approve loans, or modify records. You watch portfolio health: arrears, PAR, collections, disbursements, and operational risk.
You are given a live read-only portfolio snapshot and your most recent findings below. Use real numbers from it; never invent figures. Amounts are in ZMW (Zambian Kwacha).
Be direct and prioritised: lead with what matters most, flag risks clearly, and give concrete next actions the staff member can take in the app. Keep it tight and skimmable with markdown. If the user attaches a file, analyse it.`,

  senior_engineer: `You are "Senior Engineer AI" for the Phindu lending platform. You are talking directly to a staff member (often an admin).
You watch backend reliability: APIs, the repayment engine, PDF generation, document storage, notifications, and database integrity. You OBSERVE and ADVISE ONLY — never modify production data.
You are given the last 7 days of system telemetry, failures, and your recent findings below. Use real signals; if there are none, say things look healthy rather than inventing problems.
For each issue give a short diagnosis, a suggested fix, and an honest severity (mark anything affecting money movement or data integrity as high/critical). Keep it technical but clear, with markdown. If the user attaches logs or files, analyse them.`,
};

function sse(text: string) {
  // Emit a single OpenAI-style SSE chunk then DONE (used for early error messages).
  const chunk = {
    choices: [{ delta: { content: text, role: "assistant" }, finish_reason: "stop" }],
  };
  return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}

function streamMessage(text: string, status = 200) {
  return new Response(sse(text), {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

async function collectGuardianContext(supabase: ReturnType<typeof createClient>) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const win30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [activeLoans, schedule, recentReps, recentDisb, findings] = await Promise.all([
    supabase.from("loan_applications").select("id").eq("status", "active"),
    supabase.from("loan_repayments").select("amount, status, due_date").neq("status", "paid").eq("is_reversed", false),
    supabase.from("loan_repayments").select("amount, status, due_date").gte("due_date", win30).lte("due_date", todayIso).eq("is_reversed", false),
    supabase.from("disbursements").select("id, amount").gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
    supabase.from("ai_agent_findings").select("title, severity, status, created_at").eq("agent_key", "guardian").order("created_at", { ascending: false }).limit(8),
  ]);

  const unpaid = schedule.data ?? [];
  const overdue = unpaid.filter((r: any) => r.due_date < todayIso);
  const outstanding = unpaid.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const overdueAmount = overdue.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const due30 = recentReps.data ?? [];
  const paid30 = due30.filter((r: any) => r.status === "paid");

  return {
    as_of: todayIso,
    active_loans: (activeLoans.data ?? []).length,
    total_outstanding_zmw: Math.round(outstanding),
    overdue_count: overdue.length,
    overdue_amount_zmw: Math.round(overdueAmount),
    due_today_count: unpaid.filter((r: any) => r.due_date === todayIso).length,
    par_ratio: outstanding > 0 ? Number((overdueAmount / outstanding).toFixed(3)) : 0,
    collection_rate_30d: due30.length > 0 ? Number((paid30.length / due30.length).toFixed(3)) : null,
    disbursements_7d: (recentDisb.data ?? []).length,
    recent_findings: findings.data ?? [],
  };
}

async function collectEngineerContext(supabase: ReturnType<typeof createClient>) {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();

  const [telemetry, failedNotifs, errorRuns, findings] = await Promise.all([
    supabase.from("system_telemetry").select("source, event_type, severity, message, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(60),
    supabase.from("notification_logs").select("type, status, error_message, created_at").eq("status", "failed").gte("created_at", since).limit(30),
    supabase.from("ai_agent_runs").select("agent_key, status, error_message, created_at").eq("status", "error").gte("created_at", since).limit(15),
    supabase.from("ai_agent_findings").select("title, severity, status, created_at").eq("agent_key", "senior_engineer").order("created_at", { ascending: false }).limit(8),
  ]);

  const tel = (telemetry.data ?? []) as any[];
  const counts: Record<string, number> = {};
  for (const t of tel) counts[t.event_type] = (counts[t.event_type] || 0) + 1;

  return {
    window: "last_7_days",
    telemetry_total: tel.length,
    telemetry_by_type: counts,
    telemetry_samples: tel.slice(0, 20),
    failed_notifications: (failedNotifs.data ?? []).length,
    failed_notification_samples: (failedNotifs.data ?? []).slice(0, 10),
    failed_agent_runs: (errorRuns.data ?? []).length,
    recent_findings: findings.data ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return streamMessage("AI is not configured. Please contact your administrator.", 200);

    const body = await req.json().catch(() => ({}));
    const agent: AgentKey = ["phindu", "guardian", "senior_engineer"].includes(body.agent)
      ? body.agent
      : "phindu";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const context = typeof body.context === "string" ? body.context : "";

    const systemMessages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPTS[agent] },
    ];
    if (context) {
      systemMessages.push({ role: "system", content: `The user is currently on the page: "${context}".` });
    }

    // Guardian & Senior Engineer are staff-only and get live platform context.
    if (agent === "guardian" || agent === "senior_engineer") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "").trim();

      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) {
        return streamMessage("You need to be signed in as a staff member to talk to this agent.", 200);
      }
      const { data: isStaff } = await userClient.rpc("is_staff", { _user_id: userData.user.id });
      if (!isStaff) {
        return streamMessage("This agent is available to staff members only.", 200);
      }

      const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      try {
        const ctx =
          agent === "guardian"
            ? await collectGuardianContext(service)
            : await collectEngineerContext(service);
        systemMessages.push({
          role: "system",
          content: `Live read-only platform data (JSON):\n${JSON.stringify(ctx, null, 2)}`,
        });
      } catch (e) {
        console.error("context collection failed", e);
      }
    }

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [...systemMessages, ...messages],
        stream: true,
      }),
    });

    if (resp.status === 429) {
      return streamMessage("I'm a bit busy right now — please try again in a moment.", 200);
    }
    if (resp.status === 402) {
      return streamMessage("AI credits have run out. Please contact your administrator to top up.", 200);
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error", resp.status, errText);
      return streamMessage("Sorry, I couldn't process that. Please try again.", 200);
    }

    return new Response(resp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("ai-copilot error", e);
    return streamMessage("Something went wrong. Please try again.", 200);
  }
});
