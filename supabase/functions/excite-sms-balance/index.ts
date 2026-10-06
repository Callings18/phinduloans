import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeBaseUrl(raw: string): string {
  return (raw || "https://gateway.excitesms.com/api/v3")
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");
}

async function getExciteSmsCredentials(supabase: ReturnType<typeof createClient>) {
  const { data: providersData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_providers")
    .maybeSingle();
  const { data: configData } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "notification_config")
    .maybeSingle();
  const providers = providersData?.value || {};
  const config = configData?.value || {};
  const envToken = (Deno.env.get("EXCITESMS_API_TOKEN") || "").trim().replace(/^Bearer\s+/i, "").trim();
  const dbToken = (providers.excitesms_api_token || config.excitesms_api_token || "").trim().replace(/^Bearer\s+/i, "").trim();
  const baseUrl = normalizeBaseUrl(
    Deno.env.get("EXCITESMS_API_URL") || providers.excitesms_api_url || config.excitesms_api_url || "",
  );
  return {
    baseUrl,
    apiToken: envToken || dbToken,
  };
}

function pickBalance(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const data = obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : null;
  const candidates = [
    obj.balance,
    obj.credits,
    obj.sms_balance,
    obj.remaining,
    obj.units,
    obj.sms_units,
    data?.balance,
    data?.credits,
    data?.sms_balance,
    data?.remaining,
    data?.units,
    data?.sms_units,
  ];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : typeof c === "string" ? Number(c) : NaN;
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

async function tryFetchBalance(baseUrl: string, apiToken: string, path: string) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    return { url, ok: false, status: response.status, balance: null as number | null };
  }
  const balance = pickBalance(json);
  return { url, ok: response.ok && balance !== null, status: response.status, balance, json };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseKey) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const userId = claimsData.claims.sub as string;
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = roles?.some((r: { role: string }) =>
        ["admin", "super_admin", "loan_officer", "credit_officer", "finance_officer", "collections_officer", "auditor", "support"].includes(r.role)
      );
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { baseUrl, apiToken } = await getExciteSmsCredentials(supabase);

    if (!apiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          source: "unavailable",
          message: "ExciteSMS API token not configured",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const paths = ["/balance", "/account", "/profile", "/sms/balance", "/user/balance"];
    const attempts = [];
    for (const path of paths) {
      const attempt = await tryFetchBalance(baseUrl, apiToken, path);
      attempts.push({ path, status: attempt.status, ok: attempt.ok });
      if (attempt.ok && attempt.balance !== null) {
        return new Response(
          JSON.stringify({
            success: true,
            source: "excitesms",
            remaining_units: attempt.balance,
            fetched_at: new Date().toISOString(),
            endpoint: attempt.url,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        source: "unavailable",
        message:
          "ExciteSMS did not expose a balance endpoint for this API key. Use package size + Phindu usage tracking, or ask Excite for balance API docs.",
        attempts,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error("[excite-sms-balance]", error);
    return new Response(JSON.stringify({ success: false, error: "Balance check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
