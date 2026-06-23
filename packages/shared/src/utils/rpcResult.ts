/**
 * Standardized client-side wrapper for our PostgreSQL RPCs
 * (transition_loan_status, complete_disbursement, record_loan_payment, etc.).
 *
 * All of these RPCs return a JSONB envelope of the shape:
 *   { success?: boolean, ok?: boolean, error?: string, ...payload }
 *
 * This helper normalises both the JSON envelope AND any transport-level
 * Supabase/PostgREST error into ONE consistent shape so the UI never has
 * to branch on whether the failure happened at the network layer or inside
 * the function.
 *
 *   const res = await callRpc<{ receipt_no: string }>("record_loan_payment", { ... });
 *   if (!res.success) toast.error(res.error);  // single, friendly message
 *   else doSomething(res.data.receipt_no);
 */
import { supabase } from "@phinduloans/shared/integrations/supabase/client";
import { mapSupabaseError } from "@phinduloans/shared/utils/mapSupabaseError";

export type RpcResult<T = Record<string, unknown>> =
  | { success: true; data: T; error?: undefined }
  | { success: false; error: string; data?: undefined };

type RpcEnvelope = {
  success?: boolean;
  ok?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export async function callRpc<T = Record<string, unknown>>(
  fn: string,
  params: Record<string, unknown>,
  fallbackError = "Action failed. Please try again.",
): Promise<RpcResult<T>> {
  const { data, error } = await (supabase.rpc as any)(fn, params);

  // Transport-level error (network, RLS, missing function, bad args, …)
  if (error) {
    return { success: false, error: mapSupabaseError(error, fallbackError) };
  }

  // Some RPCs (very rare) may return null when no row matched
  if (data == null) {
    return { success: false, error: fallbackError };
  }

  // Envelope-level error returned by SECURITY DEFINER functions
  const envelope = data as RpcEnvelope;
  const ok = envelope.success === true || envelope.ok === true;
  if (!ok) {
    const msg =
      (typeof envelope.error === "string" && envelope.error.trim()) ||
      (typeof envelope.message === "string" && envelope.message.trim()) ||
      fallbackError;
    return { success: false, error: msg };
  }

  return { success: true, data: envelope as unknown as T };
}
