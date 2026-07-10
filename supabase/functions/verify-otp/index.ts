import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  phone: string;
  code: string;
  purpose?: 'signup' | 'login' | 'verify';
  // For signup with password
  email?: string;
  password?: string;
  fullName?: string;
  nrcNumber?: string;
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

    const { phone, code, purpose = 'signup', email, password, fullName, nrcNumber } = await req.json() as VerifyOTPRequest;

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`[Verify OTP] Request for ${formattedPhone}, purpose: ${purpose}`);

    await supabase
      .from("otp_codes")
      .delete()
      .eq("phone", formattedPhone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .lt("expires_at", new Date().toISOString());

    // Accept any active code for this phone so delayed SMS delivery does not trap borrowers.
    const { data: otpRecords, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", formattedPhone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError || !otpRecords?.length) {
      console.log("[Verify OTP] No OTP found for phone");
      return new Response(
        JSON.stringify({ success: false, error: "No pending OTP found. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpRecord = otpRecords.find((record: any) => record.code === code);

    if (!otpRecord) {
      const newestRecord = otpRecords[0];
      await supabase
        .from("otp_codes")
        .update({ attempts: newestRecord.attempts + 1 })
        .eq("id", newestRecord.id);

      console.log("[Verify OTP] Invalid code");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid OTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log("[Verify OTP] Max attempts exceeded");
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ success: false, error: "Maximum attempts exceeded. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts on the matched code and mark it verified.
    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1, verified_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    console.log(`[Verify OTP] OTP verified for ${formattedPhone}`);

    // Handle different purposes
    if (purpose === 'signup') {
      // Phone-only signup: synthesize a placeholder email so Supabase Auth accepts the row,
      // but never expose it in the UI.
      const safePhone = formattedPhone.replace(/[^0-9]/g, "");
      const syntheticEmail = email && email.includes("@")
        ? email
        : `${safePhone}@phone.phindu.local`;
      const generatedPassword = password || crypto.randomUUID() + crypto.randomUUID();

      // If a profile already exists for this phone, treat as login instead
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("phone", formattedPhone)
        .maybeSingle();

      let userId: string;

      if (existingProfile) {
        userId = existingProfile.id;
      } else {
        // Do NOT pass `phone` into auth.admin.createUser.
        // Phone OTP is handled by our custom send-otp/verify-otp flow; Supabase Phone Auth
        // is often disabled on Lovable, and createUser(phone=...) then fails with cryptic
        // errors that surface as the raw number (e.g. "26097xxxxxxx").
        const { data: newUser, error: signupError } = await supabase.auth.admin.createUser({
          email: syntheticEmail,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || null,
            phone: formattedPhone,
          },
        });

        if (signupError || !newUser?.user) {
          console.error("[Verify OTP] Signup error:", signupError);
          const raw = signupError?.message || "Failed to create account";
          const looksLikePhone = /^\+?260\d{9}$/.test(raw.replace(/\s+/g, ""));
          const friendly = looksLikePhone || /phone/i.test(raw)
            ? "Could not create your account. Please try again or contact support."
            : raw;
          return new Response(
            JSON.stringify({ success: false, error: friendly }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.user.id;

        // Hide synthetic email in profile; store only phone + name + NRC
        await supabase
          .from("profiles")
          .update({
            phone: formattedPhone,
            full_name: fullName || null,
            nrc_number: nrcNumber || null,
            email: syntheticEmail.endsWith("@phone.phindu.local") ? null : syntheticEmail,
          })
          .eq("id", userId);
      }

      // Issue a magic link so the borrower lands signed-in immediately
      const { data: link } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Account ready",
          userId,
          verified: true,
          magicLink: link?.properties?.action_link ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (purpose === 'login') {
      // Find user by phone (works for both real-email and synthetic-email accounts)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("phone", formattedPhone)
        .maybeSingle();

      let loginEmail = profile?.email ?? null;
      let userId = profile?.id ?? null;

      // If profile has no email (phone-only signup), recover via synthetic email on auth.users
      if (!loginEmail || !userId) {
        const safePhone = formattedPhone.replace(/[^0-9]/g, "");
        const fallback = `${safePhone}@phone.phindu.local`;
        const { data: usersByEmail } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = usersByEmail?.users?.find(
          (u) =>
            u.email === fallback ||
            u.user_metadata?.phone === formattedPhone ||
            u.phone === formattedPhone ||
            u.phone === formattedPhone.replace(/^\+/, ""),
        );
        if (match) {
          userId = match.id;
          loginEmail = match.email ?? fallback;
        } else {
          loginEmail = fallback;
        }
      }

      if (!userId || !loginEmail) {
        console.log(`[Verify OTP] No account found for phone: ${formattedPhone}`);
        return new Response(
          JSON.stringify({ success: false, error: "No account found for this number. Please sign up first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: loginEmail,
      });

      if (sessionError) {
        console.error("[Verify OTP] Session error:", sessionError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Login successful",
          verified: true,
          userId,
          magicLink: sessionData.properties?.action_link,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, verified: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Verify OTP] Error:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
