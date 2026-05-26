import { Module } from "@nestjs/common";

import { VehicleDocumentsModule } from "../vehicle-documents/vehicle-documents.module";
import { TrafficFinesController } from "./traffic-fines.controller";
import { TrafficFinesService } from "./traffic-fines.service";

@Module({
  imports: [VehicleDocumentsModule],
  controllers: [TrafficFinesController],
  providers: [TrafficFinesService],
  exports: [TrafficFinesService]
})
export class TrafficFinesModule {}
