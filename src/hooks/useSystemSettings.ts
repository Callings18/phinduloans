import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeneralConfig {
    currency: string;
    country: string;
    date_format: string;
}

export interface CompanyInfo {
    name: string;
    address: string;
    support_email: string;
    support_phone: string;
    tax_id: string;
}

export interface LendingRules {
    default_interest_rate: number;
    max_loan_amount: number;
    min_loan_amount: number;
    late_penalty_percent: number;
    grace_period_days: number;
}

export const useSystemSettings = () => {
    return useQuery({
        queryKey: ["system-settings"],
        queryFn: async () => {
            const { data, error } = await supabase.from("system_settings").select("*");
            if (error) throw error;

            const settings: any = {};
            data?.forEach((setting) => {
                settings[setting.key] = setting.value;
            });

            return {
                generalConfig: (settings.general_config as GeneralConfig) || {
                    currency: "ZMW",
                    country: "ZM",
                    date_format: "DD/MM/YYYY",
                },
                companyInfo: (settings.company_info as CompanyInfo) || {
                    name: "Phindu Loans",
                    address: "Lusaka, Zambia",
                    support_email: "support@phindu.co.zm",
                    support_phone: "+260 967 713 001",
                    tax_id: "",
                },
                lendingRules: (settings.lending_rules as LendingRules) || {
                    default_interest_rate: 15.0,
                    max_loan_amount: 50000,
                    min_loan_amount: 500,
                    late_penalty_percent: 5.0,
                    grace_period_days: 3,
                },
                notificationConfig: settings.notification_config || {},
            };
        },
        staleTime: 1000 * 60 * 10, // 10 minutes cache
    });
};
