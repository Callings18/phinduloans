import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

/**
 * JWT scaffolding for future auth parity with Supabase sessions.
 * Protected routes will use `JwtAuthGuard` + `@Roles()` once login is implemented.
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
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
