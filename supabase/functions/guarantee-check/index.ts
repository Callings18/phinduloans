import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuaranteeCheckRequest {
  loan_id: string;
  borrower_id: string;
  loan_amount: number;
  loan_term_months: number;
  borrower_nrc: string;
  borrower_name: string;
  employer_name?: string;
  monthly_income?: number;
  guarantee_provider: string;
  guarantee_percentage?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pmicApiUrl = Deno.env.get("PMIC_API_URL");
    const pmicApiKey = Deno.env.get("PMIC_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GuaranteeCheckRequest = await req.json();
    const { 
      loan_id, 
      borrower_id,
      loan_amount, 
      loan_term_months,
      borrower_nrc, 
      borrower_name,
      employer_name,
      monthly_income,
      guarantee_provider,
      guarantee_percentage = 80
    } = body;

    // Validate required fields
    if (!loan_id || !borrower_nrc || !loan_amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if guarantee already exists for this loan
    const { data: existingGuarantee } = await supabase
      .from("guarantees")
      .select("*")
      .eq("loan_id", loan_id)
      .single();

    if (existingGuarantee && existingGuarantee.status === "approved") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: "approved",
          guarantee_id: existingGuarantee.id,
          reference_code: existingGuarantee.reference_code,
          guaranteed_amount: existingGuarantee.guaranteed_amount,
          message: "Guarantee already approved for this loan"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guaranteed_amount = (loan_amount * guarantee_percentage) / 100;
    const guarantee_fee = (guaranteed_amount * 2) / 100; // 2% fee

    let guaranteeResult: any = {
      success: false,
      status: "pending",
    };

    // Check if PMIC API is configured
    if (pmicApiUrl && pmicApiKey) {
      try {
        // Call actual PMIC/Guarantee API
        const apiResponse = await fetch(`${pmicApiUrl}/check-eligibility`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${pmicApiKey}`,
          },
          body: JSON.stringify({
            borrower_nrc,
            borrower_name,
            employer_name,
            monthly_income,
            loan_amount,
            loan_term_months,
            requested_guarantee_amount: guaranteed_amount,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`Guarantee API returned ${apiResponse.status}`);
        }

        const apiData = await apiResponse.json();
        
        guaranteeResult = {
          success: apiData.eligible || apiData.approved,
          status: apiData.eligible ? "approved" : "rejected",
          reference_code: apiData.reference_code || apiData.eligibility_code,
          eligibility_code: apiData.eligibility_code,
          conditions: apiData.conditions,
          validity_start: apiData.validity_start,
          validity_end: apiData.validity_end,
        };

      } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : "Unknown error";
        console.error("Guarantee API call failed:", apiError);
        
        guaranteeResult = {
          success: false,
          status: "failed",
          message: `Guarantee API unavailable: ${errorMessage}. Manual entry required.`,
        };
      }
    } else {
      // Mock response for development/testing
      console.log("Guarantee API not configured, using mock response");
      
      // Simple mock eligibility based on income ratio
      const dti = monthly_income ? (loan_amount / loan_term_months) / monthly_income : 1;
      const isEligible = dti < 0.5;
      
      guaranteeResult = {
        success: isEligible,
        status: isEligible ? "approved" : "rejected",
        reference_code: isEligible ? `PMIC-${Date.now().toString(36).toUpperCase()}` : null,
        eligibility_code: isEligible ? "ELIG-OK" : "ELIG-DTI-HIGH",
        conditions: isEligible ? ["Standard terms apply", "Valid for 12 months"] : ["DTI ratio exceeds limit"],
        validity_start: new Date().toISOString().split("T")[0],
        validity_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      };
    }

    // Create or update guarantee record
    const guaranteeData = {
      loan_id,
      guarantee_provider,
      status: guaranteeResult.status,
      reference_code: guaranteeResult.reference_code,
      eligibility_code: guaranteeResult.eligibility_code,
      guaranteed_amount,
      guaranteed_percentage: guarantee_percentage,
      guarantee_fee,
      validity_start: guaranteeResult.validity_start,
      validity_end: guaranteeResult.validity_end,
      conditions: guaranteeResult.conditions,
      response_payload: guaranteeResult,
      approval_date: guaranteeResult.status === "approved" ? new Date().toISOString() : null,
    };

    let guaranteeRecord;
    if (existingGuarantee) {
      const { data, error } = await supabase
        .from("guarantees")
        .update(guaranteeData)
        .eq("id", existingGuarantee.id)
        .select()
        .single();
      
      if (error) throw error;
      guaranteeRecord = data;
    } else {
      const { data, error } = await supabase
        .from("guarantees")
        .insert(guaranteeData)
        .select()
        .single();
      
      if (error) throw error;
      guaranteeRecord = data;
    }

    // Log to audit
    await supabase.from("audit_logs").insert({
      action: "GUARANTEE_CHECK",
      entity_type: "guarantee",
      entity_id: guaranteeRecord.id,
      details: { 
        loan_id, 
        provider: guarantee_provider,
        status: guaranteeResult.status, 
        guaranteed_amount 
      },
    });

    return new Response(
      JSON.stringify({
        success: guaranteeResult.success,
        status: guaranteeResult.status,
        guarantee_id: guaranteeRecord.id,
        reference_code: guaranteeResult.reference_code,
        eligibility_code: guaranteeResult.eligibility_code,
        guaranteed_amount,
        guaranteed_percentage: guarantee_percentage,
        guarantee_fee,
        validity_start: guaranteeResult.validity_start,
        validity_end: guaranteeResult.validity_end,
        conditions: guaranteeResult.conditions,
        message: guaranteeResult.status === "approved" 
          ? "Guarantee approved" 
          : guaranteeResult.error || "Guarantee not approved",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Guarantee check error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
