export type ActorType = "borrower" | "admin" | "system";

export const STAFF_ROLES = new Set([
  "admin",
  "super_admin",
  "loan_officer",
  "credit_officer",
  "finance_officer",
  "collections_officer",
  "auditor",
  "support",
]);

export function isStaffRole(roles: string[]): boolean {
  return roles.some((r) => STAFF_ROLES.has(r));
}

export function actorTypeFromRoles(roles: string[]): ActorType {
  return isStaffRole(roles) ? "admin" : "borrower";
}
