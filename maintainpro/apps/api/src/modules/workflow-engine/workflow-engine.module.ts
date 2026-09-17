import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ConfigSimulatorController } from "./config-simulator.controller";
import { WorkflowEngineController } from "./workflow-engine.controller";
import { WorkflowEngineService } from "./workflow-engine.service";

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowEngineController, ConfigSimulatorController],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService]
})
export class WorkflowEngineModule {}
