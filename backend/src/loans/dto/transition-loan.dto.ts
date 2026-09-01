import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TransitionLoanDto {
  @ApiPropertyOptional({ description: "Canonical RPC action (approve, reject, verify_documents, finance_approve, …)" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  action?: string;

  @ApiPropertyOptional({ description: "Target status; mapped to an RPC action when `action` is omitted" })
  @IsOptional()
  @IsString()
  toStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonText?: string;
}
