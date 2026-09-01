import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import { CreateApplicationDto, CreateBorrowerDto, RecordPaymentDto } from "./dto/core-writes.dto";
import { CoreWritesService } from "./core-writes.service";

@ApiTags("core-writes")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller({ version: "1" })
export class CoreWritesController {
  constructor(private readonly core: CoreWritesService) {}

  @Post("admin/borrowers")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create or link a borrower (replaces create-borrower Edge Function)" })
  createBorrower(@Body() dto: CreateBorrowerDto, @CurrentUser() user: AuthUser) {
    return this.core.createBorrower(dto, user);
  }

  @Post("applications")
  @ApiOperation({ summary: "Create a loan application (borrower portal or staff)" })
  createApplication(@Body() dto: CreateApplicationDto, @CurrentUser() user: AuthUser) {
    return this.core.createApplication(dto, user);
  }

  @Post("repayments/:repaymentId/record")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Record a repayment via record_loan_payment (receipt payload)" })
  recordPayment(@Param("repaymentId") repaymentId: string, @Body() dto: RecordPaymentDto) {
    return this.core.recordPayment(repaymentId, dto);
  }
}
