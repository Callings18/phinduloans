import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { ReviewPaymentClaimDto } from "./dto/review-payment-claim.dto";
import { SubmitPaymentClaimDto } from "./dto/submit-payment-claim.dto";
import { PaymentClaimsService } from "./payment-claims.service";
import { LoansService } from "../loans/loans.service";

@ApiTags("payment-claims")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller({ version: "1" })
export class PaymentClaimsController {
  constructor(
    private readonly claims: PaymentClaimsService,
    private readonly loans: LoansService,
  ) {}

  @Post("repayments/:repaymentId/payment-claims")
  @ApiOperation({ summary: "Borrower submits a payment claim for an installment" })
  async submit(
    @Param("repaymentId") repaymentId: string,
    @Body() dto: SubmitPaymentClaimDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
  ) {
    const requestId = this.loans.newRequestId(requestIdHeader);
    return this.claims.submit(repaymentId, dto, user, requestId);
  }

  @Get("admin/payment-claims")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "List payment claims by status (staff)" })
  async listAdmin(@Query("status") status?: string) {
    return this.claims.listAdmin(status ?? "pending_review");
  }

  @Post("payment-claims/:claimId/review")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Review a payment claim (staff)" })
  async review(
    @Param("claimId") claimId: string,
    @Body() dto: ReviewPaymentClaimDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
    @Headers("idempotency-key") _idempotencyKey?: string,
  ) {
    const requestId = this.loans.newRequestId(requestIdHeader);
    return this.claims.review(claimId, dto, user, requestId);
  }
}
