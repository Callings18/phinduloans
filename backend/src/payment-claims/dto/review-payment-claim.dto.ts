import { IsIn, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReviewPaymentClaimDto {
  @ApiProperty({ enum: ["approved", "rejected", "needs_more_info"] })
  @IsIn(["approved", "rejected", "needs_more_info"])
  decision!: "approved" | "rejected" | "needs_more_info";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewComment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionReasonCode?: string;
}
