import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Liveness" })
  liveness() {
    return {
      ok: true,
      service: "phinduloans-api",
      version: "v1",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness (database)" })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: "phinduloans-api",
      database: "up",
      timestamp: new Date().toISOString(),
    };
  }
}
