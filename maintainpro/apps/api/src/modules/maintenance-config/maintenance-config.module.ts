import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { MaintenanceConfigController } from "./maintenance-config.controller";
import { MaintenanceConfigService } from "./maintenance-config.service";
import { MaintenanceTemplatesService } from "./maintenance-templates.service";
import { TenantFeaturesService } from "./tenant-features.service";

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceConfigController],
  providers: [MaintenanceConfigService, TenantFeaturesService, MaintenanceTemplatesService],
  exports: [MaintenanceConfigService, TenantFeaturesService, MaintenanceTemplatesService]
})
export class MaintenanceConfigModule {}
