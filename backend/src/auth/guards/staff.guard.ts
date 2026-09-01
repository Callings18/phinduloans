import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthUser } from "../auth-user";

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Authentication is required", details: null },
      });
    }
    if (req.user.actorType !== "admin") {
      throw new ForbiddenException({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Only admin/staff can perform this action",
          details: null,
        },
      });
    }
    return true;
  }
}
