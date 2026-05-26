import { Module } from "@nestjs/common";

import { AccidentsController } from "./accidents.controller";
import { AccidentsService } from "./accidents.service";

@Module({
  controllers: [AccidentsController],
  providers: [AccidentsService],
  exports: [AccidentsService]
})
export class AccidentsModule {}
