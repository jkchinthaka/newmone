import { Module } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { UtilitiesController } from "./utilities.controller";
import { UtilitiesService } from "./utilities.service";

@Module({
  imports: [EvidenceModule],
  controllers: [UtilitiesController],
  providers: [UtilitiesService],
  exports: [UtilitiesService]
})
export class UtilitiesModule {}
