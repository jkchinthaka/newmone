import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ReliabilityController } from "./reliability.controller";
import { ReliabilityService } from "./reliability.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReliabilityController],
  providers: [ReliabilityService],
  exports: [ReliabilityService]
})
export class ReliabilityModule {}
