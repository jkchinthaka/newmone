import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ReliabilityModule } from "../reliability/reliability.module";
import { JobReadinessController } from "./job-readiness.controller";
import { JobReadinessService } from "./job-readiness.service";

@Module({
  imports: [PrismaModule, ReliabilityModule],
  controllers: [JobReadinessController],
  providers: [JobReadinessService],
  exports: [JobReadinessService]
})
export class JobReadinessModule {}
