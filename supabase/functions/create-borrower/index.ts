import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user has admin/staff role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id);

    const isAdmin = roles?.some(r =>
      ["admin", "super_admin", "loan_officer"].includes(r.role)
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized - admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { full_name, phone, nrc_number, address, city, product_code, gender, marital_status } = body;
    let { email } = body;

    if (!full_name || (!email && !phone)) {
      return new Response(JSON.stringify({ error: "Full name and either email or phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Synthesise a placeholder email when only phone was provided (Marketeer flow).
    // Supabase auth still needs a unique email, but the profile row keeps email = null
    // so the UI never displays the placeholder.
    const syntheticEmail = !email && phone
      ? `${String(phone).replace(/[^0-9]/g, "")}@phone.phindu.local`
      : null;
    const authEmail = email || syntheticEmail!;
    const profileEmail = email || null;

    let userId: string;
    let createdNew = false;

    // Try to create user first
    const tempPassword = crypto.randomUUID().slice(0, 10) + "Aa1!";
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
      phone: phone || undefined,
      user_metadata: { full_name },
    });

    if (createError) {
      // If email already exists, look up the existing user by querying profiles
      if (createError.message?.includes("already been registered") || (createError as any).code === "email_exists") {
        console.log("User already exists, looking up by email:", email);

        // Look up user via profiles table (more reliable than paginated listUsers)
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (profileError || !profile) {
          // Fallback: paginated search through auth users
          let foundId: string | null = null;
          let page = 1;
          while (!foundId) {
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
            if (listError || !listData.users.length) break;
            const match = listData.users.find(u => u.email === email);
            if (match) { foundId = match.id; break; }
            if (listData.users.length < 100) break;
            page++;
          }
          if (!foundId) {
            return new Response(JSON.stringify({ error: "User exists in auth but profile not found. Please contact support." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          userId = foundId;
        } else {
          userId = profile.id;
        }

        // Upsert profile for existing auth users too. Some older auth users may not
        // have a profiles row yet, and product_house_borrowers FK requires it.
        const { error: upsertExistingProfileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: userId,
            email,
            full_name,
            phone: phone || null,
            nrc_number: nrc_number || null,
            address: address || null,
            city: city || null,
            gender: gender || null,
            marital_status: marital_status || null,
          }, { onConflict: "id" });

        if (upsertExistingProfileError) {
          console.error("Error upserting existing borrower profile:", upsertExistingProfileError);
          return new Response(JSON.stringify({ error: `Profile update failed: ${upsertExistingProfileError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (product_code) {
          const { error: houseLinkError } = await supabaseAdmin
            .from("product_house_borrowers")
            .upsert(
              {
                product_code,
                borrower_id: userId,
                added_by: requestingUser.id,
              },
              { onConflict: "product_code,borrower_id" }
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
            message: `Borrower profile updated. This email (${email}) was already registered.`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = newUser.user.id;
      createdNew = true;
    }

    // Upsert profile (handle_new_user trigger may not have created it yet)
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name,
        phone: phone || null,
        nrc_number: nrc_number || null,
        address: address || null,
        city: city || null,
        gender: gender || null,
        marital_status: marital_status || null,
      }, { onConflict: "id" });

    if (upsertError) {
      console.error("Error upserting profile:", upsertError);
      return new Response(JSON.stringify({ error: `Profile creation failed: ${upsertError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send SMS with login credentials (phone-only OTP/password) for newly created borrowers
    if (createdNew && phone) {
      try {
        const smsBody = `Welcome to Phindu Loans! Your account has been created. Login email: ${email} | Temp password: ${tempPassword} | Or login with phone OTP. https://phindu.com`;
        await supabaseAdmin.functions.invoke("excite-sms", {
          body: { to: phone, message: smsBody, userId, title: "Account credentials" },
        });
      } catch (smsErr) {
        console.error("Failed to send credentials SMS:", smsErr);
      }
    }

    if (product_code) {
      const { error: houseLinkError } = await supabaseAdmin
        .from("product_house_borrowers")
        .upsert(
          {
            product_code,
            borrower_id: userId,
            added_by: requestingUser.id,
          },
          { onConflict: "product_code,borrower_id" }
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
      }
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
