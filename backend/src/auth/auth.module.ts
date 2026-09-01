import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { StaffGuard } from "./guards/staff.guard";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { SupabaseService } from "./supabase.service";

/**
 * Supabase bearer sessions for current clients; JWT module remains for a later native auth cutover.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "dev-only-change-me",
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES ?? "15m",
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, SupabaseService, SupabaseAuthGuard, StaffGuard],
  exports: [AuthService, JwtModule, SupabaseService, SupabaseAuthGuard, StaffGuard],
})
export class AuthModule {}
