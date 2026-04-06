import { CanActivate, Injectable } from "@nestjs/common";

/**
 * Placeholder: will enforce `Roles()` + JWT once admin APIs migrate off Supabase RLS.
 * Always allows — avoids accidental lockout during strangler rollout.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
