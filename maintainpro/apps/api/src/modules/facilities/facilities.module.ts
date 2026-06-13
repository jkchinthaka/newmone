import { Module } from "@nestjs/common";

import { FacilitiesController } from "./facilities.controller";
import { FacilityLocationBackfillService } from "./facility-location-backfill.service";
import { FacilitiesService } from "./facilities.service";

@Module({
  controllers: [FacilitiesController],
  providers: [FacilitiesService, FacilityLocationBackfillService],
  exports: [FacilitiesService, FacilityLocationBackfillService]
})
export class FacilitiesModule {}
