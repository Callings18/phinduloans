import { apiPost } from "@phinduloans/shared/api/httpClient";
import { apiFeatureFlags } from "@phinduloans/shared/config/apiMode";
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import type { PaymentReceiptData } from "@phinduloans/shared/utils/handlePaymentReceipt";
import { callRpc } from "@phinduloans/shared/utils/rpcResult";

export interface CreateBorrowerInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  nrc_number?: string | null;
  address?: string | null;
  city?: string | null;
  product_code?: string;
  gender?: string | null;
  marital_status?: string | null;
}

export async function createBorrower(input: CreateBorrowerInput) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{
      ok?: boolean;
      success?: boolean;
      user_id?: string;
      existing?: boolean;
      message?: string;
      error?: { message?: string };
    }>("/api/v1/admin/borrowers", input);
  }
  const response = await supabase.functions.invoke("create-borrower", { body: input });
  if (response.error) {
    const details = (response.error as { context?: { json?: { error?: string } }; message?: string })?.context?.json?.error
      || (response.error as { message?: string })?.message;
    throw new Error(details || "Borrower creation failed.");
  }
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}

export async function createStaffUser(input: {
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
}) {
  if (apiFeatureFlags.coreWrites) {
    return apiPost<{
      ok?: boolean;
      success?: boolean;
      user_id?: string;
      temp_password?: string;
      message?: string;
    }>("/api/v1/admin/staff", input);
  }
  const res = await supabase.functions.invoke("create-staff-user", { body: input });
  if (res.error) throw new Error(res.error.message || "Failed to create user");
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export async function createLoanApplication(input: {
  application: Record<string, unknown>;
  borrowers?: Record<string, unknown>[];
  productCode?: string;
}): Promise<{ id: string }> {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: { id: string } }>("/api/v1/applications", input);
    const id = res?.data?.id;
    if (!id) throw new Error("Application was not created");
    return { id };
  }
  const { data, error } = await supabase.from("loan_applications").insert(input.application).select("id").single();
  if (error || !data) throw error ?? new Error("Application was not created");
  if (input.borrowers?.length) {
    await supabase.from("loan_borrowers").insert(
      input.borrowers.map((row) => ({ ...row, loan_application_id: data.id })),
    );
  }
  return { id: data.id };
}

export async function recordLoanPayment(params: {
  repaymentId: string;
  amount: number;
  paymentMethod?: string;
  accountId?: string | null;
  transactionReference?: string | null;
  paidDate?: string | null;
  penaltyAmount?: number;
}): Promise<PaymentReceiptData> {
  if (apiFeatureFlags.coreWrites) {
    const res = await apiPost<{ ok?: boolean; data?: PaymentReceiptData }>(
      `/api/v1/repayments/${params.repaymentId}/record`,
      {
        amount: params.amount,
        paymentMethod: params.paymentMethod || "cash",
        accountId: params.accountId || null,
        transactionReference: params.transactionReference || null,
        paidDate: params.paidDate || null,
        penaltyAmount: params.penaltyAmount,
      },
    );
    const rpc = res?.data;
    if (!rpc || rpc.success === false) {
      throw new Error(rpc?.error || "Payment recording failed");
    }
    return { success: true, ...rpc };
  }

  const rpcArgs: Record<string, unknown> = {
    p_repayment_id: params.repaymentId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod || "cash",
    p_account_id: params.accountId || null,
    p_transaction_reference: params.transactionReference || null,
    p_paid_date: params.paidDate || null,
  };
  if (params.penaltyAmount !== undefined && params.penaltyAmount > 0) {
    rpcArgs.p_penalty_amount = params.penaltyAmount;
  }
  const res = await callRpc<PaymentReceiptData>("record_loan_payment", rpcArgs, "Payment recording failed");
  if (!res.success) throw new Error(res.error);
  return { success: true, ...res.data } as PaymentReceiptData;
}
