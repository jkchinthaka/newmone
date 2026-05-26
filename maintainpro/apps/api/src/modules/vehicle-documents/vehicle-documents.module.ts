import { Module } from "@nestjs/common";

import { ComplianceModule } from "../compliance/compliance.module";
import { VehicleDocumentsController } from "./vehicle-documents.controller";
import { VehicleDocumentsService } from "./vehicle-documents.service";

@Module({
  imports: [ComplianceModule],
  controllers: [VehicleDocumentsController],
  providers: [VehicleDocumentsService],
  exports: [VehicleDocumentsService]
})
export class VehicleDocumentsModule {}
