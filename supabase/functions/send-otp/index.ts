import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  phone: string;
  purpose?: 'signup' | 'login' | 'verify';
}

function formatPhoneNumber(phone: string): string {
  let formatted = phone.trim().replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  
  if (formatted.startsWith("+260")) {
    return formatted;
  } else if (formatted.startsWith("260")) {
    return "+" + formatted;
  } else if (formatted.startsWith("0")) {
    return "+260" + formatted.substring(1);
  } else if (formatted.length === 9 && !formatted.startsWith("+")) {
    return "+260" + formatted;
  } else if (formatted.startsWith("+")) {
    return formatted;
  } else {
    return "+260" + formatted;
  }
}

function generateOTP(): string {
  // Generate 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getExciteSmsCredentials(supabase: any): Promise<{
  apiUrl: string;
  apiToken: string;
  senderId: string;
}> {
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
  
  // Correct URL is .tech not .com
  const apiUrl = providers.excitesms_api_url || config.excitesms_api_url || Deno.env.get("EXCITESMS_API_URL") || "https://gateway.excitesms.tech/api/v3";
  // Fix common URL mistake (.com vs .tech)
  const correctedApiUrl = apiUrl.replace("gateway.excitesms.com", "gateway.excitesms.tech");
  
  return {
    apiUrl: correctedApiUrl,
    apiToken: providers.excitesms_api_token || config.excitesms_api_token || Deno.env.get("EXCITESMS_API_TOKEN") || "",
    senderId: providers.excitesms_sender_id || config.excitesms_sender_id || Deno.env.get("EXCITESMS_SENDER_ID") || "Phindu",
  };
}

async function sendSMS_ExciteSMS(to: string, message: string, creds: any): Promise<any> {
  if (!creds.apiToken) {
    throw new Error("ExciteSMS API token not configured");
  }

  const phone = formatPhoneNumber(to).replace("+", "");
  const url = `${creds.apiUrl}/sms/send`;

  console.log(`[OTP - ExciteSMS] Sending to ${phone}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      recipient: phone,
      sender_id: creds.senderId,
      type: "plain",
      message: message,
    }),
  });

  const result = await response.json();
  console.log("[OTP - ExciteSMS] Response:", JSON.stringify(result));

  if (result.status === "error") {
    throw new Error(result.message || "Failed to send OTP via ExciteSMS");
  }

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { phone, purpose = 'signup' } = await req.json() as OTPRequest;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`[OTP] Request for ${formattedPhone}, purpose: ${purpose}`);

    // Check rate limiting - max 3 OTPs per phone in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", formattedPhone)
      .gte("created_at", tenMinutesAgo);

    if (recentCount && recentCount >= 3) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many OTP requests. Please try again in 10 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For login, check if user exists
    if (purpose === 'login') {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (!existingProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found with this phone number. Please sign up first." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Invalidate any existing OTPs for this phone
    await supabase
      .from("otp_codes")
      .delete()
      .eq("phone", formattedPhone)
      .is("verified_at", null);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        phone: formattedPhone,
        code: otp,
        expires_at: expiresAt.toISOString(),
        purpose,
      });

    if (insertError) {
      console.error("[OTP] Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via ExciteSMS
    const creds = await getExciteSmsCredentials(supabase);
    const message = `Your Phindu Finance verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

    await sendSMS_ExciteSMS(formattedPhone, message, creds);

    // Log the notification
    await supabase.from("notification_logs").insert({
      type: "sms",
      recipient: formattedPhone,
      title: "OTP Verification",
      message: "OTP code sent for verification",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    console.log(`[OTP] Successfully sent to ${formattedPhone}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expiresIn: 300, // 5 minutes in seconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[OTP] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
