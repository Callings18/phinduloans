import type { Json } from "@/integrations/supabase/types";
import type { LoanProductCode } from "@/config/loanProductModules";

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type ReviewChecklistResult = {
  items: ChecklistItem[];
  completed: number;
  total: number;
};

function getProductCode(value: string | null | undefined): LoanProductCode | null {
  if (!value) return null;
  if (
    value === "SALARY_ADVANCE" ||
    value === "PAYDAY_SOFT" ||
    value === "COLLATERAL" ||
    value === "BUSINESS" ||
    value === "MOTOR_VEHICLE" ||
    value === "MARKETEER"
  ) {
    return value;
  }
  return null;
}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

const requiredByProduct: Record<LoanProductCode, string[]> = {
  SALARY_ADVANCE: ["nrc_front", "nrc_back", "selfie_holding_nrc", "payslip_1", "bank_statement_1"],
  PAYDAY_SOFT: ["nrc_front", "nrc_back", "selfie_holding_nrc", "proof_of_residence", "sketch_map_residence"],
  COLLATERAL: ["nrc_front", "nrc_back", "selfie_holding_nrc", "collateral_details"],
  BUSINESS: ["nrc_front", "nrc_back", "financial_statement", "pacra_certificate", "tax_clearance"],
  MOTOR_VEHICLE: ["nrc_front", "nrc_back", "selfie_holding_nrc", "vehicle_photos"],
  MARKETEER: ["nrc_front", "nrc_back", "selfie_holding_nrc", "video_business_stock", "video_residence"],
};

export function useLoanReviewChecklist(application: {
  loan_product_id?: string | null;
  product_specific_data?: Json | null;
  status?: string | null;
  approval_stage?: string | null;
  document_verified_at?: string | null;
  finance_verified_at?: string | null;
  approved_at?: string | null;
} | null): ReviewChecklistResult {
  if (!application) return { items: [], completed: 0, total: 0 };

  const data = asRecord(application.product_specific_data);
  const code = getProductCode((data.product_code as string | undefined) || undefined);

  const docKeys = code ? requiredByProduct[code] : [];
  const uploadedDocs = asRecord(data.uploaded_docs as Json | null | undefined);
  const docItems: ChecklistItem[] = docKeys.map((k) => ({
    id: `doc-${k}`,
    label: `Document: ${k}`,
    done: Boolean(uploadedDocs[k]),
  }));

  const stageItems: ChecklistItem[] = [
    { id: "docs-verified", label: "Documents verified", done: Boolean(application.document_verified_at) },
    { id: "officer-review", label: "Loan officer review complete", done: (application.approval_stage || "") !== "" },
    { id: "finance-review", label: "Finance review complete", done: Boolean(application.finance_verified_at) },
    { id: "manager-approval", label: "Manager approval complete", done: Boolean(application.approved_at) },
  ];

  const items = [...docItems, ...stageItems];
  const completed = items.filter((i) => i.done).length;
  return { items, completed, total: items.length };
}
