import { Module } from "@nestjs/common";

import { ReportingKpisController } from "./reporting-kpis.controller";

@Module({
  controllers: [ReportingKpisController]
})
export class ReportingKpisModule {}
