import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LoansModule } from "../loans/loans.module";
import { PaymentClaimsController } from "./payment-claims.controller";
import { PaymentClaimsService } from "./payment-claims.service";

@Module({
  imports: [AuthModule, LoansModule],
  controllers: [PaymentClaimsController],
  providers: [PaymentClaimsService],
})
export class PaymentClaimsModule {}
