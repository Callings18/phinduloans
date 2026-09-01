import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DisbursementsController, LoansController } from "./loans.controller";
import { LoansService } from "./loans.service";

@Module({
  imports: [AuthModule],
  controllers: [LoansController, DisbursementsController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
