import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CoreWritesModule } from "./core/core-writes.module";
import { HealthModule } from "./health/health.module";
import { LoanProductsModule } from "./loan-products/loan-products.module";
import { LoansModule } from "./loans/loans.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PaymentClaimsModule } from "./payment-claims/payment-claims.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    LoanProductsModule,
    CoreWritesModule,
    LoansModule,
    PaymentClaimsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
