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

    const { phone, code, purpose = 'signup', email, password, fullName } = await req.json() as VerifyOTPRequest;

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`[Verify OTP] Request for ${formattedPhone}, purpose: ${purpose}`);

    // Get the latest OTP for this phone
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", formattedPhone)
      .eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      console.log("[Verify OTP] No OTP found for phone");
      return new Response(
        JSON.stringify({ success: false, error: "No pending OTP found. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP has expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.log("[Verify OTP] OTP expired");
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log("[Verify OTP] Max attempts exceeded");
      await supabase.from("otp_codes").delete().eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ success: false, error: "Maximum attempts exceeded. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify the code
    if (otpRecord.code !== code) {
      console.log("[Verify OTP] Invalid code");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid OTP code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("otp_codes")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    console.log(`[Verify OTP] OTP verified for ${formattedPhone}`);

    // Handle different purposes
    if (purpose === 'signup') {
      // For signup with password
      if (email && password && fullName) {
        // Create user with email/password
        const { data: newUser, error: signupError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          phone: formattedPhone,
          phone_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (signupError) {
          console.error("[Verify OTP] Signup error:", signupError);
          return new Response(
            JSON.stringify({ success: false, error: signupError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update profile with phone
        await supabase
          .from("profiles")
          .update({ phone: formattedPhone })
          .eq("id", newUser.user.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Account created successfully",
            userId: newUser.user.id,
            verified: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Passwordless signup - just verify the phone for now
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Phone verified successfully",
            verified: true,
            phone: formattedPhone,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (purpose === 'login') {
      // Find user by phone
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("phone", formattedPhone)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: "No account found with this phone number" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a magic link or session
      // For passwordless login, we'll create a session token
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
        options: {
          redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '')}/dashboard`,
        },
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
          userId: profile.id,
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
