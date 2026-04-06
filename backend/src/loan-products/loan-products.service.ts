import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decimalsToNumbers } from "../common/utils/serialize-prisma";
import { ListLoanProductsQueryDto } from "./dto/list-loan-products.query.dto";

@Injectable()
export class LoanProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListLoanProductsQueryDto): Promise<Record<string, unknown>[]> {
    const active = query.active !== false;
    const sort = query.sort ?? "name";
    const order = query.order ?? "asc";

    const orderBy: Prisma.LoanProductOrderByWithRelationInput =
      sort === "name"
        ? { name: order }
        : sort === "interest_rate"
          ? { interest_rate: order }
          : { min_amount: order };

    const where: Prisma.LoanProductWhereInput = active ? { is_active: true } : {};

    const rows = await this.prisma.loanProduct.findMany({
      where,
      orderBy,
    });

    return rows.map((r) => decimalsToNumbers(r) as Record<string, unknown>);
  }
}
