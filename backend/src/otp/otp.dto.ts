import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length, MinLength } from "class-validator";

export class SendOtpDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ enum: ["signup", "login", "verify"] })
  @IsOptional()
  @IsIn(["signup", "login", "verify"])
  purpose?: "signup" | "login" | "verify";
}

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional({ enum: ["signup", "login", "verify"] })
  @IsOptional()
  @IsIn(["signup", "login", "verify"])
  purpose?: "signup" | "login" | "verify";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nrcNumber?: string;
}
