// Phindu AI Copilot — a friendly, read-only conversational assistant.
// Streams responses from the Lovable AI Gateway. It NEVER mutates platform data;
// it only answers questions, explains the platform, and guides the user.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You are "Phindu Assistant", a warm, upbeat AI helper embedded in the Phindu Loan Management Platform (a Zambian micro-lending system).

Your personality:
- Friendly, concise, and encouraging. Use a light, professional tone.
- You are a guide and explainer, not an operator. You CANNOT approve loans, change repayments, disburse funds, or modify any records. If asked to do those, politely explain that the user must perform those actions through the proper screens, and point them to where.

What you help with:
- Explaining how features work (loans, repayments, disbursements, KYC, payroll, reports, collections).
- Helping users find the right page or workflow.
- Answering general questions about lending concepts, the platform, and Zambian context (NRC, NAPSA, NHIMA, PAYE).
- Drafting messages, summarising concepts, and offering tips.

Style rules:
- Keep answers short and skimmable. Use markdown (bold, bullet points) when helpful.
- If you don't know something specific to this user's data, say so and suggest where to look.
- Never invent figures or claim to have performed an action.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(context
        ? [{ role: "system", content: `Current context: the user is on "${context}".` }]
        : []),
      ...(Array.isArray(messages) ? messages : []),
    ];

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
        stream: true,
      }),
    });

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "I'm a bit busy right now. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits have run out. Please contact your administrator." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error", resp.status, errText);
      return new Response(JSON.stringify({ error: "Sorry, I couldn't process that." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
