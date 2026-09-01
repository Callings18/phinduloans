import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SubmitPaymentClaimDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty()
  @IsString()
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  receiptUrl?: string | null;
}
