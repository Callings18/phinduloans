import { IsArray, IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RecordPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  penaltyAmount?: number;
}

export class CreateBorrowerDto {
  @ApiProperty()
  @IsString()
  full_name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nrc_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  product_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marital_status?: string;
}

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  full_name!: string;

  @ApiProperty()
  @IsString()
  role!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;
}

export class CreateApplicationDto {
  @ApiProperty()
  @IsObject()
  application!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  borrowers?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productCode?: string;
}

export class RejectWriteOffDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class RecoverWriteOffDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetExpenseStatusDto {
  @ApiProperty()
  @IsString()
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectReason?: string;
}

export class ReversePaymentDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class DeleteLoanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePendingDisbursementDto {
  @ApiProperty()
  @IsString()
  loanId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty()
  @IsString()
  disbursementMethod!: string;

  @ApiProperty()
  @IsString()
  sourceAccountId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accountNumber?: string | null;
}

export class ReloanDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newPrincipal!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  newTermMonths!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  interestRate!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  monthlyPayment!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  totalRepayment!: number;

  @ApiProperty({ example: "2026-09-02" })
  @IsString()
  reloanDate!: string;

  @ApiProperty()
  @IsString()
  parentNotes!: string;

  @ApiProperty()
  @IsString()
  childNotes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  optionalTopUpAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  topUpNetDisbursement?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  topUpFees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentEventReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childEventReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  previousValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;
}

export class TopUpLoanDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  additionalAmount!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  netDisbursement!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalFees!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newPrincipal!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newTotalRepayment!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newMonthlyPayment!: number;

  @ApiProperty()
  @IsString()
  notes!: string;

  @ApiProperty()
  @IsString()
  sourceAccountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  newTermMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  previousValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;
}

export class RestructureLoanDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  principal!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  newTermMonths!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  newInterestRate!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newTotalRepayment!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  newMonthlyPayment!: number;

  @ApiProperty()
  @IsString()
  notes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  previousValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;
}

export class UpdateLoanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  application?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "When set, replace all loan_borrowers rows" })
  @IsOptional()
  @IsArray()
  borrowers?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  profile?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileUserId?: string;
}

export class RegisterLoanDocumentsDto {
  @ApiProperty()
  @IsArray()
  documents!: Array<{
    borrower_id: string;
    doc_type: string;
    doc_label: string;
    file_url: string;
    file_name: string;
    mime_type?: string | null;
    file_size?: number | null;
    loan_product_id?: string | null;
    saveToVault?: boolean;
  }>;
}

export class BorrowerSignContractDto {
  @ApiProperty()
  @IsString()
  signedContractUrl!: string;
}
