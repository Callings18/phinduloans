import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/http-errors";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserRoles, isAdminRole, type ActorType } from "@/lib/roles";

export interface AuthContext {
  userId: string;
  roles: string[];
  actorType: ActorType;
}

export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid bearer token");
  }

  const roles = await getUserRoles(user.id);
  return {
    userId: user.id,
    roles,
    actorType: isAdminRole(roles) ? "admin" : "borrower",
  };
}

export function requireAdmin(ctx: AuthContext) {
  if (ctx.actorType !== "admin") {
    throw new HttpError(403, "FORBIDDEN", "Admin role required");
  }
}
