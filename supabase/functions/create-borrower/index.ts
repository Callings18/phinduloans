import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhoneForAuth(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("260") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `260${digits.slice(1)}`;
  if (digits.length >= 9) return `260${digits}`;
  return digits;
}

function looksLikeDuplicateUserError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("phone") ||
    message.includes("email") ||
    code === "email_exists" ||
    code === "phone_exists" ||
    code === "user_already_exists"
  );
}

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

    if (!full_name || (!email && !phone)) {
      return new Response(JSON.stringify({ error: "Full name and either email or phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhoneForAuth(phone);
    phone = normalizedPhone;

    const syntheticEmail = !email && normalizedPhone ? `${normalizedPhone}@phone.phindu.local` : null;
    const authEmail = email || syntheticEmail!;
    const profileEmail = email || null;

    let userId: string;
    let createdNew = false;

    const tempPassword = crypto.randomUUID().slice(0, 10) + "Aa1!";
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      phone: normalizedPhone || undefined,
      user_metadata: { full_name },
    });

    if (createError) {
      if (looksLikeDuplicateUserError(createError)) {
        console.log("Borrower already exists, resolving existing user", { authEmail, normalizedPhone });

        let foundId: string | null = null;

        const profileFilters = [];
        if (authEmail) profileFilters.push(`email.eq.${authEmail}`);
        if (normalizedPhone) profileFilters.push(`phone.eq.${normalizedPhone}`);

        if (profileFilters.length > 0) {
          const { data: profileMatches, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, email, phone")
            .or(profileFilters.join(","))
            .limit(5);

          if (!profileError && profileMatches?.length) {
            foundId = profileMatches[0].id;
          }
        }

        if (!foundId) {
          let page = 1;
          while (!foundId) {
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
            if (listError || !listData.users.length) break;
            const match = listData.users.find((u) => u.email === authEmail || (normalizedPhone ? u.phone === normalizedPhone : false));
            if (match) {
              foundId = match.id;
              break;
            }
            if (listData.users.length < 100) break;
            page++;
          }
        }

        if (!foundId) {
          return new Response(JSON.stringify({ error: `Borrower already exists, but the existing profile could not be resolved automatically. ${createError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = foundId;

        const { error: upsertExistingProfileError } = await supabaseAdmin.from("profiles").upsert(
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

        if (upsertExistingProfileError) {
          console.error("Error upserting existing borrower profile:", upsertExistingProfileError);
          return new Response(JSON.stringify({ error: `Profile update failed: ${upsertExistingProfileError.message}` }), {
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
            console.error("Error linking existing borrower to product house:", houseLinkError);
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

      console.error("Error creating user:", createError);
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
      console.error("Error upserting profile:", upsertError);
      return new Response(JSON.stringify({ error: `Profile creation failed: ${upsertError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (createdNew && normalizedPhone) {
      try {
        const smsBody = profileEmail
          ? `Welcome to Phindu Loans! Your account has been created. Login email: ${profileEmail} | Temp password: ${tempPassword} | Or login with phone OTP. https://phindu.com`
          : `Welcome to Phindu Loans! Your account has been created. Login with your phone number using OTP at https://phindu.com`;
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
        console.error("Error linking new borrower to product house:", houseLinkError);
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
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});