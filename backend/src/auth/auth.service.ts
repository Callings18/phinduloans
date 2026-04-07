import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

/** Placeholder for email/password or magic-link auth replacing Supabase Auth. */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /** Future: issue access + refresh tokens after credential verification. */
  async signAccessToken(payload: { sub: string; roles: string[] }): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
