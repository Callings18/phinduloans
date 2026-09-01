import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TransitionLoanDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  toStatus!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonText?: string;
}
