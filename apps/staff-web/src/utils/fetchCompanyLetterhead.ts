import { supabase } from "@phinduloans/shared/integrations/supabase/client";

export type CompanyLetterhead = {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
};

/**
 * Load company letterhead from system_settings.company_info (key/value JSON).
 */
export async function fetchCompanyLetterhead(): Promise<CompanyLetterhead> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .eq("key", "company_info")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object") {
    return {};
  }

  const value = data.value as Record<string, unknown>;
  return {
    companyName: typeof value.name === "string" ? value.name : undefined,
    companyAddress: typeof value.address === "string" ? value.address : undefined,
    companyPhone:
      typeof value.support_phone === "string"
        ? value.support_phone
        : typeof value.phone === "string"
          ? value.phone
          : undefined,
  };
}
