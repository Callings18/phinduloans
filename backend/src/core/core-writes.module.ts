import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CoreWritesController } from "./core-writes.controller";
import { CoreWritesService } from "./core-writes.service";

@Module({
  imports: [AuthModule],
  controllers: [CoreWritesController],
  providers: [CoreWritesService],
})
export class CoreWritesModule {}
