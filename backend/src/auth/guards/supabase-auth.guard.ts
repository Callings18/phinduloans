import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth-user";
import { actorTypeFromRoles } from "../staff-roles";
import { SupabaseService } from "../supabase.service";
import { apiFail } from "../../common/http";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Missing bearer token", details: null },
      });
    }

    const client = this.supabase.getClient();
    if (!client) {
      apiFail(
        HttpStatus.SERVICE_UNAVAILABLE,
        "AUTH_NOT_CONFIGURED",
        "Supabase auth is not configured on this API",
      );
    }

    const token = header.slice("Bearer ".length).trim();
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid bearer token", details: null },
      });
    }

    const roleRows = await this.prisma.userRole.findMany({
      where: { user_id: user.id },
      select: { role: true },
    });
    const roles = roleRows.map((r) => r.role);
    req.user = {
      userId: user.id,
      roles,
      actorType: actorTypeFromRoles(roles),
    };
    return true;
  }
}
