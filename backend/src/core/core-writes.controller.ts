import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth-user";
import { StaffGuard } from "../auth/guards/staff.guard";
import { SupabaseAuthGuard } from "../auth/guards/supabase-auth.guard";
import {
  BorrowerSignContractDto,
  CreateApplicationDto,
  CreateBorrowerDto,
  CreateLoanNoteDto,
  CreatePendingDisbursementDto,
  CreateStaffDto,
  CreateWriteOffDto,
  DeleteLoanDto,
  GenerateScheduleDto,
  RecordPaymentDto,
  RecoverWriteOffDto,
  RegisterLoanDocumentsDto,
  RejectWriteOffDto,
  ReloanDto,
  RestructureLoanDto,
  ReversePaymentDto,
  SetExpenseStatusDto,
  TopUpLoanDto,
  UpdateLoanDto,
  UpsertLoanDraftDto,
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

  @Get("loan-drafts")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "List loan application drafts" })
  listLoanDrafts(
    @Query("borrowerId") borrowerId?: string,
    @Query("productCode") productCode?: string,
  ) {
    return this.core.listLoanDrafts({ borrowerId, productCode });
  }

  @Get("loan-drafts/:id")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Load one loan application draft" })
  getLoanDraft(@Param("id") id: string) {
    return this.core.getLoanDraft(id);
  }

  @Put("loan-drafts")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create or update a staff loan application draft" })
  upsertLoanDraft(@Body() dto: UpsertLoanDraftDto, @CurrentUser() user: AuthUser) {
    return this.core.upsertLoanDraft(dto, user);
  }

  @Delete("loan-drafts/:id")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Delete a loan application draft" })
  deleteLoanDraft(@Param("id") id: string) {
    return this.core.deleteLoanDraft(id);
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

  @Post("write-offs")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create a pending write-off request" })
  createWriteOff(@Body() dto: CreateWriteOffDto, @CurrentUser() user: AuthUser) {
    return this.core.createWriteOff(dto, user);
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

  @Post("repayments/:repaymentId/reverse")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Reverse a recorded repayment and debit the credited account" })
  reversePayment(
    @Param("repaymentId") repaymentId: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.core.reversePayment(repaymentId, dto.reason, user);
  }

  @Post("loans/:loanId/undo-disbursement")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Refund source account, drop schedule, revert loan to approved" })
  undoDisbursement(@Param("loanId") loanId: string, @CurrentUser() user: AuthUser) {
    return this.core.undoDisbursement(loanId, user);
  }

  @Post("loans/:loanId/delete")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Delete a pre-disbursement loan application" })
  deleteLoan(
    @Param("loanId") loanId: string,
    @Body() dto: DeleteLoanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.core.deleteLoan(loanId, dto.reason, user);
  }

  @Post("disbursements")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Create a pending disbursement (complete separately)" })
  createPending(@Body() dto: CreatePendingDisbursementDto) {
    return this.core.createPendingDisbursement(dto);
  }

  @Post("loans/:loanId/schedule")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Insert or regenerate the repayment schedule (no browser writes)" })
  generateSchedule(
    @Param("loanId") loanId: string,
    @Body() dto: GenerateScheduleDto = {},
  ) {
    return this.core.generateSchedule(loanId, dto.regenerateRemaining === true);
  }

  @Post("loans/:loanId/reloan")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Close parent loan and open a carry-forward or fresh reloan" })
  reloan(@Param("loanId") loanId: string, @Body() dto: ReloanDto, @CurrentUser() user: AuthUser) {
    return this.core.reloan(loanId, dto, user);
  }

  @Post("loans/:loanId/top-up")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Increase principal, rebuild remaining schedule, debit source account" })
  topUp(@Param("loanId") loanId: string, @Body() dto: TopUpLoanDto, @CurrentUser() user: AuthUser) {
    return this.core.topUpLoan(loanId, dto, user);
  }

  @Post("loans/:loanId/restructure")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Change remaining term/rate and rebuild the unpaid schedule tail" })
  restructure(@Param("loanId") loanId: string, @Body() dto: RestructureLoanDto, @CurrentUser() user: AuthUser) {
    return this.core.restructureLoan(loanId, dto, user);
  }

  @Patch("loans/:loanId")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Staff update of loan fields, collateral parties, or borrower profile" })
  updateLoan(@Param("loanId") loanId: string, @Body() dto: UpdateLoanDto, @CurrentUser() user: AuthUser) {
    return this.core.updateLoan(loanId, dto, user);
  }

  @Post("loans/:loanId/documents")
  @ApiOperation({ summary: "Register uploaded KYC/document metadata after storage upload" })
  registerDocuments(
    @Param("loanId") loanId: string,
    @Body() dto: RegisterLoanDocumentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.core.registerLoanDocuments(loanId, dto.documents, user);
  }

  @Post("loans/:loanId/borrower-sign")
  @ApiOperation({ summary: "Borrower records a signed contract path and advances pre-disbursement status" })
  borrowerSign(
    @Param("loanId") loanId: string,
    @Body() dto: BorrowerSignContractDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.core.borrowerSignContract(loanId, dto.signedContractUrl, user);
  }

  @Post("loans/:loanId/notes")
  @UseGuards(StaffGuard)
  @ApiOperation({ summary: "Add an internal or borrower-visible loan note" })
  addLoanNote(
    @Param("loanId") loanId: string,
    @Body() dto: CreateLoanNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.core.addLoanNote(loanId, dto, user);
  }
}
