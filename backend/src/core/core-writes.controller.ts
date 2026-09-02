import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import {
  CreateApplicationDto,
  CreateBorrowerDto,
  CreateStaffDto,
  RecordPaymentDto,
  RecoverWriteOffDto,
  RejectWriteOffDto,
  SetExpenseStatusDto,
} from "./dto/core-writes.dto";
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

  @Post("admin/staff")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create a staff user with email/password (replaces create-staff-user Edge Function)" })
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser) {
    return this.core.createStaff(dto, user);
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

  @Post("loans/:loanId/penalties")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Apply overdue penalties via apply_loan_penalties" })
  applyPenalties(@Param("loanId") loanId: string) {
    return this.core.applyPenalties(loanId);
  }

  @Get("loans/:loanId/early-settlement")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Quote early settlement via calculate_early_settlement" })
  earlySettlement(@Param("loanId") loanId: string) {
    return this.core.earlySettlementQuote(loanId);
  }

  @Post("loans/:loanId/reconcile-completion")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Mark loan completed when schedule is fully paid" })
  reconcile(@Param("loanId") loanId: string) {
    return this.core.reconcileCompletion(loanId);
  }

  @Post("write-offs/:id/approve")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Approve a pending write-off" })
  approveWriteOff(@Param("id") id: string) {
    return this.core.approveWriteOff(id);
  }

  @Post("write-offs/:id/reject")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Reject a pending write-off" })
  rejectWriteOff(@Param("id") id: string, @Body() dto: RejectWriteOffDto) {
    return this.core.rejectWriteOff(id, dto.reason);
  }

  @Post("write-offs/:id/recover")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Record recovery against an approved write-off" })
  recoverWriteOff(@Param("id") id: string, @Body() dto: RecoverWriteOffDto) {
    return this.core.recoverWriteOff(id, dto.amount, dto.notes);
  }

  @Post("expenses/:id/status")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Approve, reject, or mark an expense paid" })
  setExpenseStatus(@Param("id") id: string, @Body() dto: SetExpenseStatusDto) {
    return this.core.setExpenseStatus(id, dto.status, dto.rejectReason);
  }

  @Post("admin/repayments/shift-business-days")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Shift pending installments off non-working days" })
  shiftPending() {
    return this.core.shiftPendingRepayments();
  }
}
