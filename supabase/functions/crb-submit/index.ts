import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CRBSubmitRequest {
  borrower_id: string;
  loan_id: string;
  nrc_number: string;
  loan_amount: number;
  disbursement_date: string;
  repayment_performance: "full" | "partial" | "default";
  default_amount?: number;
  settlement_date?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const crbApiUrl = Deno.env.get("CRB_API_URL");
    const crbApiKey = Deno.env.get("CRB_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AUTHORIZATION CHECK: Verify calling user is authenticated staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const staffRoles = ["admin", "super_admin", "loan_officer", "finance_officer"];
    const isStaff = roles?.some((r: { role: string }) => staffRoles.includes(r.role));

    if (!isStaff) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - staff access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CRBSubmitRequest = await req.json();
    const { 
      borrower_id, 
      loan_id, 
      nrc_number, 
      loan_amount, 
      disbursement_date, 
      repayment_performance, 
      default_amount,
      settlement_date 
    } = body;

    // Validate required fields
    if (!borrower_id || !loan_id || !nrc_number) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create CRB submission record
    const { data: crbRequest, error: insertError } = await supabase
      .from("crb_requests")
      .insert({
        borrower_id,
        loan_application_id: loan_id,
        nrc_number,
        request_type: "submit_history",
        request_payload: { 
          loan_amount, 
          disbursement_date, 
          repayment_performance, 
          default_amount,
          settlement_date 
        },
        consent_obtained: true,
        status: "pending",
        provider: "creditbridge",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating CRB submission record:", insertError);
      throw new Error("Failed to create CRB submission record");
    }

    let submissionResult = { success: true, message: "Submission recorded" };

    // Check if CRB API is configured
    if (crbApiUrl && crbApiKey) {
      try {
        // Call actual CRB API to submit history
        const apiResponse = await fetch(`${crbApiUrl}/submit-history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${crbApiKey}`,
          },
          body: JSON.stringify({
            nrc_number,
            loan_id,
            loan_amount,
            disbursement_date,
            repayment_performance,
            default_amount: default_amount || 0,
            settlement_date,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`CRB API returned ${apiResponse.status}`);
        }

        const apiData = await apiResponse.json();
        submissionResult = { 
          success: true, 
          message: `Successfully submitted to CRB. Ref: ${apiData.reference_id || "N/A"}`
        };

      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : "Unknown error";
        console.error("CRB submission API call failed:", apiError);
        
        // Update request as failed but don't throw - we'll retry later
        await supabase
          .from("crb_requests")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", crbRequest.id);

        submissionResult = { 
          success: false, 
          message: `CRB submission failed - will retry. Error: ${errorMessage}`
        };
      }
    } else {
      console.log("CRB API not configured, submission recorded locally");
      submissionResult = { 
        success: true, 
        message: "CRB API not configured - submission recorded for later sync" 
      };
    }

    // Update CRB request with result
    await supabase
      .from("crb_requests")
      .update({
        status: submissionResult.success ? "success" : "failed",
        response_payload: submissionResult,
      })
      .eq("id", crbRequest.id);

    // Log to audit
    await supabase.from("audit_logs").insert({
      action: "CRB_SUBMIT",
      entity_type: "crb_request",
      entity_id: crbRequest.id,
      details: { loan_id, repayment_performance, result: submissionResult.success },
    });

    return new Response(
      JSON.stringify({ ...submissionResult, request_id: crbRequest.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("CRB submit error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
