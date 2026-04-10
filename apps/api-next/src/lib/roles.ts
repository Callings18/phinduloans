import { supabaseAdmin } from "@/lib/supabase-admin";

export type ActorType = "borrower" | "admin" | "system";

const adminRoles = new Set([
  "admin",
  "super_admin",
  "loan_officer",
  "credit_officer",
  "finance_officer",
  "collections_officer",
  "auditor",
]);

export async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as string);
}

export function isAdminRole(roles: string[]): boolean {
  return roles.some((r) => adminRoles.has(r));
}
