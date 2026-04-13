import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional } from "class-validator";

export class ListLoanProductsQueryDto {
  @ApiPropertyOptional({ description: "Only active products", default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return true;
    if (value === false || value === 0) return false;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    }
    return true;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: ["name", "interest_rate", "min_amount"], default: "name" })
  @IsOptional()
  @IsIn(["name", "interest_rate", "min_amount"])
  sort?: "name" | "interest_rate" | "min_amount";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "asc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";
}
