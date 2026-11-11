import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isDuplicateBorrowerAuthError,
  matchesBorrowerAuthIdentity,
  normalizeBorrowerPhone,
} from "./borrowerIdentity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: requestingUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", requestingUser.id);

    const isAdmin = roles?.some((r) => ["admin", "super_admin", "loan_officer"].includes(r.role));

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized - admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { full_name, nrc_number, address, city, product_code, gender, marital_status } = body;
    let { email, phone } = body;

    if (!full_name) {
      return new Response(JSON.stringify({ error: "Full name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizeBorrowerPhone(phone);
    if (phone && !normalizedPhone) {
      return new Response(JSON.stringify({ error: "Enter a valid Zambian mobile number (for example, 0979 943 293)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email is no longer collected. We still need a unique auth identifier, so we
    // synthesize one from the phone number, or fall back to a name-based slug.
    const nameSlug = String(full_name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "borrower";
    const syntheticEmail = !email
      ? (normalizedPhone
        ? `${normalizedPhone.replace(/^\+/, "")}@phone.phindu.local`
        : `${nameSlug}.${Date.now()}@borrower.phindu.local`)
      : null;
    const authEmail = email || syntheticEmail!;
    const profileEmail = email || null;


    let userId: string;
    let createdNew = false;

    const tempPassword = crypto.randomUUID().slice(0, 10) + "Aa1!";
    // IMPORTANT: when a phone is provided we MUST also pass phone_confirm: true.
    // Otherwise GoTrue treats the phone as unconfirmed and tries to dispatch an
    // SMS confirmation, which fails (no SMS provider configured in auth) and the
    // whole createUser call returns a non-2xx error — this was breaking Marketeer
    // borrower creation (phone-only borrowers). The OTP signup flow (verify-otp)
    // already creates phone users with phone_confirm: true, so mirror it here.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
      user_metadata: { full_name },
    });

    if (createError) {
      if (isDuplicateBorrowerAuthError(createError)) {
        let matchedUser: { id: string; email?: string | null; phone?: string | null } | null = null;
        const perPage = 200;
        const maxPages = 50;

        for (let page = 1; page <= maxPages && !matchedUser; page++) {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listError) {
            console.error("Could not resolve duplicate borrower account", { code: listError.code || "unknown" });
            return new Response(JSON.stringify({ error: "An account already uses this phone number or email, but it could not be matched safely. Ask an administrator to review the borrower record." }), {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          matchedUser = listData.users.find((user) => matchesBorrowerAuthIdentity(user, authEmail, normalizedPhone)) ?? null;
          if (listData.users.length < perPage) break;
        }

        if (!matchedUser) {
          return new Response(JSON.stringify({ error: "An account already uses this phone number or email, but its borrower profile could not be matched. Check the details or ask an administrator to review it." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = matchedUser.id;

        const { error: upsertExistingProfileError } = await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            ...(matchedUser.email && !matchedUser.email.endsWith(".local") ? { email: matchedUser.email } : {}),
            full_name,
            phone: normalizedPhone || matchedUser.phone || null,
            nrc_number: nrc_number || null,
            address: address || null,
            city: city || null,
            gender: gender || null,
            marital_status: marital_status || null,
          },
          { onConflict: "id" },
        );

        if (upsertExistingProfileError) {
          console.error("Error updating existing borrower profile", { code: upsertExistingProfileError.code || "unknown" });
          return new Response(JSON.stringify({ error: "The existing borrower account was found, but the profile could not be updated. Please try again or contact an administrator." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (product_code) {
          const { error: houseLinkError } = await supabaseAdmin.from("product_house_borrowers").upsert(
            {
              product_code,
              borrower_id: userId,
              added_by: requestingUser.id,
            },
            { onConflict: "product_code,borrower_id" },
          );

          if (houseLinkError) {
            console.error("Error linking existing borrower to product house", { code: houseLinkError.code || "unknown" });
            return new Response(JSON.stringify({ error: houseLinkError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            existing: true,
            message: profileEmail
              ? `Borrower profile updated. This email (${profileEmail}) was already registered.`
              : `Borrower profile updated. This phone number was already registered.`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.error("Error creating borrower Auth user", { code: createError.code || "unknown" });
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userId = newUser.user.id;
    createdNew = true;

    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: profileEmail,
        full_name,
        phone: normalizedPhone || null,
        nrc_number: nrc_number || null,
        address: address || null,
        city: city || null,
        gender: gender || null,
        marital_status: marital_status || null,
      },
      { onConflict: "id" },
    );

    if (upsertError) {
      console.error("Error creating borrower profile", { code: upsertError.code || "unknown" });
      return new Response(JSON.stringify({ error: `Profile creation failed: ${upsertError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (createdNew && normalizedPhone) {
      try {
        const borrowerAppUrl = (Deno.env.get("BORROWER_APP_URL") || "https://app.phindu.com").replace(/\/+$/, "");
        const smsBody = `Welcome to Phindu Loans! Your account has been created. Login with your phone number using OTP at ${borrowerAppUrl}`;
        await supabaseAdmin.functions.invoke("excite-sms", {
          body: { to: normalizedPhone, message: smsBody, userId, title: "Account credentials" },
        });
      } catch (smsErr) {
        console.error("Failed to send credentials SMS:", smsErr);
      }
    }

    if (product_code) {
      const { error: houseLinkError } = await supabaseAdmin.from("product_house_borrowers").upsert(
        {
          product_code,
          borrower_id: userId,
          added_by: requestingUser.id,
        },
        { onConflict: "product_code,borrower_id" },
      );

      if (houseLinkError) {
        console.error("Error linking new borrower to product house", { code: houseLinkError.code || "unknown" });
        return new Response(JSON.stringify({ error: houseLinkError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        existing: false,
        message: "Borrower created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Borrower creation request failed", { name: error instanceof Error ? error.name : "unknown" });
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
