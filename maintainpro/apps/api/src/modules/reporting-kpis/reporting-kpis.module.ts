import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ReportingKpisController } from "./reporting-kpis.controller";
import { ReportingKpisService } from "./reporting-kpis.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReportingKpisController],
  providers: [ReportingKpisService],
  exports: [ReportingKpisService]
})
export class ReportingKpisModule {}
