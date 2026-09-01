import type { ActorType } from "./staff-roles";

export interface AuthUser {
  userId: string;
  roles: string[];
  actorType: ActorType;
}
