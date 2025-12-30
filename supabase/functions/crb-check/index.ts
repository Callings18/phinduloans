import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CRBCheckRequest {
  borrower_id: string;
  loan_application_id: string;
  nrc_number: string;
  full_name: string;
  date_of_birth?: string;
  consent_obtained: boolean;
}

interface CRBResponse {
  success: boolean;
  credit_score?: number;
  risk_rating?: string;
  blacklist_flag?: boolean;
  loan_history?: any[];
  recommendation?: string;
  request_id?: string;
  error?: string;
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

    const body: CRBCheckRequest = await req.json();
    const { borrower_id, loan_application_id, nrc_number, full_name, date_of_birth, consent_obtained } = body;

    // Validate consent
    if (!consent_obtained) {
      return new Response(
        JSON.stringify({ success: false, error: "Borrower consent is required for CRB check" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!nrc_number || !borrower_id) {
      return new Response(
        JSON.stringify({ success: false, error: "NRC number and borrower ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create CRB request record
    const { data: crbRequest, error: insertError } = await supabase
      .from("crb_requests")
      .insert({
        borrower_id,
        loan_application_id,
        nrc_number,
        request_type: "credit_check",
        request_payload: { full_name, date_of_birth, nrc_number },
        consent_obtained,
        consent_timestamp: new Date().toISOString(),
        status: "pending",
        provider: "creditbridge",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating CRB request record:", insertError);
      throw new Error("Failed to create CRB request record");
    }

    let crbResponse: CRBResponse;

    // Check if CRB API is configured
    if (crbApiUrl && crbApiKey) {
      try {
        // Call actual CRB API
        const apiResponse = await fetch(`${crbApiUrl}/credit-score`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${crbApiKey}`,
          },
          body: JSON.stringify({
            nrc_number,
            full_name,
            date_of_birth,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`CRB API returned ${apiResponse.status}`);
        }

        const apiData = await apiResponse.json();
        
        crbResponse = {
          success: true,
          credit_score: apiData.credit_score || apiData.score,
          risk_rating: apiData.risk_rating || apiData.rating,
          blacklist_flag: apiData.blacklist_flag || apiData.blacklisted || false,
          loan_history: apiData.loan_history || apiData.history || [],
          request_id: crbRequest.id,
        };
      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : "Unknown error";
        console.error("CRB API call failed:", apiError);
        
        // Update request as failed
        await supabase
          .from("crb_requests")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", crbRequest.id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "CRB API call failed. Application flagged for manual review.",
            request_id: crbRequest.id 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Mock response for development/testing when API not configured
      console.log("CRB API not configured, using mock response");
      
      // Generate consistent mock score based on NRC for testing
      const mockScore = 300 + (nrc_number.charCodeAt(0) % 400);
      
      crbResponse = {
        success: true,
        credit_score: mockScore,
        risk_rating: mockScore >= 600 ? "good" : mockScore >= 400 ? "fair" : "poor",
        blacklist_flag: false,
        loan_history: [],
        request_id: crbRequest.id,
      };
    }

    // Determine recommendation based on score thresholds
    let recommendation = "manual_review";
    if (crbResponse.credit_score) {
      if (crbResponse.credit_score >= 600) {
        recommendation = "auto_approve";
      } else if (crbResponse.credit_score < 250) {
        recommendation = "auto_decline";
      }
    }
    if (crbResponse.blacklist_flag) {
      recommendation = "auto_decline";
    }

    crbResponse.recommendation = recommendation;

    // Update CRB request with response
    await supabase
      .from("crb_requests")
      .update({
        status: "success",
        response_payload: crbResponse,
        credit_score: crbResponse.credit_score,
        blacklist_flag: crbResponse.blacklist_flag,
        risk_rating: crbResponse.risk_rating,
      })
      .eq("id", crbRequest.id);

    // Log to audit
    await supabase.from("audit_logs").insert({
      action: "CRB_CHECK",
      entity_type: "crb_request",
      entity_id: crbRequest.id,
      details: { loan_application_id, credit_score: crbResponse.credit_score, recommendation },
    });

    return new Response(
      JSON.stringify(crbResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("CRB check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
