import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
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
  @ApiOperation({ summary: "Transition loan application status (staff)" })
  async transition(
    @Param("id") id: string,
    @Body() dto: TransitionLoanDto,
    @CurrentUser() user: AuthUser,
    @Headers("x-request-id") requestIdHeader?: string,
  ) {
    const requestId = this.loans.newRequestId(requestIdHeader);
    return this.loans.transition(id, dto, user, requestId);
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
