import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/** Role names aligned with frontend `user_roles.role` values. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
