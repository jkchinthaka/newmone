import { Module } from "@nestjs/common";

import { DomainCoverageController } from "./domain-coverage.controller";

@Module({
  controllers: [DomainCoverageController]
})
export class DomainCoverageModule {}
