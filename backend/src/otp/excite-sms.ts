import { Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPhoneNumber } from "./phone";

type ExciteSmsRoute = { apiUrl: string; apiToken: string; senderId: string; label: string };

type SmsSettings = {
  excitesms: { primary: ExciteSmsRoute; secondary?: ExciteSmsRoute };
};

type SmsSendResult = {
  provider: "excitesms";
  providerResponse: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

const logger = new Logger("ExciteSms");

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};

function cleanApiToken(token: string): string {
  return (token || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function pickToken(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    const cleaned = cleanApiToken(candidate || "");
    if (cleaned) return cleaned;
  }
  return "";
}

function normalizeExciteSmsUrl(url: string): string {
  return (url || "https://gateway.excitesms.com/api/v3")
    .replace("gateway.excitesms.tech", "gateway.excitesms.com")
    .replace(/\/sms\/send\/?$/i, "")
    .replace(/\/+$/, "");
}

export async function getSmsSettings(supabase: SupabaseClient): Promise<SmsSettings> {
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

  const providers = (providersData?.value || {}) as JsonRecord;
  const config = (configData?.value || {}) as JsonRecord;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const rawApiUrl =
    str(providers.excitesms_api_url) ||
    str(config.excitesms_api_url) ||
    process.env.EXCITESMS_API_URL ||
    "https://gateway.excitesms.com/api/v3";

  const primaryApiToken = pickToken(
    process.env.EXCITESMS_API_TOKEN,
    str(providers.excitesms_api_token),
    str(config.excitesms_api_token),
  );
  const secondaryApiToken = pickToken(
    process.env.EXCITESMS_SECONDARY_API_TOKEN,
    str(providers.excitesms_secondary_api_token),
    str(config.excitesms_api_token) !== primaryApiToken ? str(config.excitesms_api_token) : "",
    str(providers.excitesms_api_token) !== primaryApiToken ? str(providers.excitesms_api_token) : "",
  );
  const senderId =
    pickToken(str(providers.excitesms_sender_id), str(config.excitesms_sender_id), process.env.EXCITESMS_SENDER_ID) ||
    "Phindu";

  return {
    excitesms: {
      primary: {
        apiUrl: normalizeExciteSmsUrl(rawApiUrl),
        apiToken: primaryApiToken,
        senderId,
        label: "primary",
      },
      secondary:
        secondaryApiToken && secondaryApiToken !== primaryApiToken
          ? {
              apiUrl: normalizeExciteSmsUrl(rawApiUrl),
              apiToken: secondaryApiToken,
              senderId:
                pickToken(
                  str(providers.excitesms_secondary_sender_id),
                  str(providers.excitesms_sender_id),
                  process.env.EXCITESMS_SECONDARY_SENDER_ID,
                  process.env.EXCITESMS_SENDER_ID,
                ) || senderId,
              label: "secondary",
            }
          : undefined,
    },
  };
}

async function sendViaExciteSms(to: string, message: string, route: ExciteSmsRoute): Promise<SmsSendResult> {
  const apiToken = cleanApiToken(route.apiToken);
  if (!apiToken) {
    throw new Error("ExciteSMS is not configured. Set EXCITESMS_API_TOKEN on the Nest API service.");
  }

  const e164 = formatPhoneNumber(to);
  const msisdn = e164.replace(/^\+/, "");

  const attempt = async (recipient: string, includeType: boolean) => {
    const body: Record<string, string> = {
      recipient,
      sender_id: route.senderId,
      message,
    };
    if (includeType) body.type = "plain";

    const response = await fetch(`${route.apiUrl}/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      logger.error(`ExciteSMS non-JSON (${response.status}): ${responseText.slice(0, 200)}`);
      throw new Error("ExciteSMS delivery failed (invalid provider response)");
    }
    return { response, result: asRecord(parsedResult) };
  };

  let response: Response;
  let result: JsonRecord;
  ({ response, result } = await attempt(msisdn, true));

  const deliveryStatus = String(asRecord(result.data).status || result.status || "").toLowerCase();
  const providerMsgFirst = String(result.message || "").toLowerCase();
  const rejected =
    !response.ok || result.status === "error" || ["failed", "rejected", "undelivered"].includes(deliveryStatus);

  if (rejected) {
    if (
      response.status === 401 ||
      providerMsgFirst.includes("unauthenticated") ||
      providerMsgFirst.includes("unauthorized")
    ) {
      throw new Error("ExciteSMS authentication failed. Update EXCITESMS_API_TOKEN on the API service.");
    }
    try {
      ({ response, result } = await attempt(e164, false));
    } catch {
      /* fall through */
    }
  }

  const data = asRecord(result.data);
  const finalStatus = String(data.status || result.status || "").toLowerCase();
  if (!response.ok || result.status === "error" || ["failed", "rejected", "undelivered"].includes(finalStatus)) {
    const providerMsg = String(result.message || data.message || "").trim();
    if (/unauthenticated|unauthorized/i.test(providerMsg) || response.status === 401) {
      throw new Error("ExciteSMS authentication failed. Update EXCITESMS_API_TOKEN on the API service.");
    }
    const looksLikePhone = /^\+?260\d{9}$/.test(providerMsg.replace(/\s+/g, ""));
    throw new Error(
      looksLikePhone || !providerMsg
        ? "ExciteSMS rejected the OTP. Verify the approved sender ID and account balance."
        : `SMS delivery failed: ${providerMsg}`,
    );
  }

  return {
    provider: "excitesms",
    providerResponse: {
      provider: "excitesms",
      route: route.label,
      status: result.status,
      provider_message: result.message,
      data: {
        id: data.id,
        uid: data.uid,
        to: data.to,
        from: data.from,
        status: data.status,
        cost: data.cost,
        sms_count: data.sms_count,
      },
    },
  };
}

export async function deliverOtpSms(
  to: string,
  message: string,
  settings: SmsSettings,
  preferSecondary: boolean,
): Promise<SmsSendResult> {
  const preferred =
    preferSecondary && settings.excitesms.secondary ? settings.excitesms.secondary : settings.excitesms.primary;
  const fallback = preferred === settings.excitesms.secondary ? settings.excitesms.primary : settings.excitesms.secondary;

  try {
    return await sendViaExciteSms(to, message, preferred);
  } catch (error) {
    if (fallback) {
      logger.warn(`Preferred ExciteSMS route failed; retrying alternate (${fallback.label})`);
      return await sendViaExciteSms(to, message, fallback);
    }
    throw error;
  }
}
