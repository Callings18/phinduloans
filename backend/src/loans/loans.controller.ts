import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { CompleteDisbursementDto, DisburseLoanDto } from "./dto/complete-disbursement.dto";
import { TransitionLoanDto } from "./dto/transition-loan.dto";
import { LoansService } from "./loans.service";

@ApiTags("loans")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller({ path: "loans", version: "1" })
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post(":id/transitions")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Staff loan workflow (RPC transition_loan_status or under_review)" })
  async transition(
    @Param("id") id: string,
    @Body() dto: TransitionLoanDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
  ) {
    const requestId = this.loans.newRequestId(requestIdHeader);
    return this.loans.transition(id, dto, user, requestId);
  }

  @Post(":id/disburse")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create a pending disbursement and complete it via complete_disbursement" })
  async disburse(
    @Param("id") id: string,
    @Body() dto: DisburseLoanDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
  ) {
    return this.loans.disburseLoan(id, dto, user, this.loans.newRequestId(requestIdHeader));
  }

  @Get(":id/events")
  @ApiOperation({ summary: "Loan event timeline" })
  async events(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Query("scope") scope?: string,
  ) {
    return this.loans.listEvents(id, user, scope);
  }
}

@ApiTags("disbursements")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, StaffGuard)
@Controller({ path: "disbursements", version: "1" })
export class DisbursementsController {
  constructor(private readonly loans: LoansService) {}

  @Post(":id/complete")
  @ApiOperation({ summary: "Complete a pending disbursement via complete_disbursement RPC" })
  complete(
    @Param("id") id: string,
    @Body() dto: CompleteDisbursementDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
  ) {
    return this.loans.completeDisbursement(id, dto, user, this.loans.newRequestId(requestIdHeader));
  }
}
