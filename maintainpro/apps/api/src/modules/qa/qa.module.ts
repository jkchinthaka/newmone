import { Module } from "@nestjs/common";

import { QaController } from "./qa.controller";
import { QaIssuesService } from "./qa-issues.service";

@Module({
  controllers: [QaController],
  providers: [QaIssuesService],
  exports: [QaIssuesService]
})
export class QaModule {}
