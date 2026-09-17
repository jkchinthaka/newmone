import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { MaintenanceConfigController } from "./maintenance-config.controller";
import { MaintenanceConfigService } from "./maintenance-config.service";

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceConfigController],
  providers: [MaintenanceConfigService],
  exports: [MaintenanceConfigService]
})
export class MaintenanceConfigModule {}
