import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { LoanProductsService } from "./loan-products.service";
import { ListLoanProductsQueryDto } from "./dto/list-loan-products.query.dto";

@ApiTags("loan-products")
@Controller({ path: "loan-products", version: "1" })
export class LoanProductsController {
  constructor(private readonly loanProductsService: LoanProductsService) {}

  @Get()
  @ApiOperation({ summary: "List loan products (public read model)" })
  async list(@Query() query: ListLoanProductsQueryDto) {
    return this.loanProductsService.findAll(query);
  }
}
