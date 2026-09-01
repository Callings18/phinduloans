import { IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompleteDisbursementDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  accountId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  transactionReference?: string | null;
}

export class DisburseLoanDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  accountId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  disbursementMethod!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  accountNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  transactionReference?: string | null;
}
