import { Module } from "@nestjs/common";

import { DeliveryReadinessController } from "./delivery-readiness.controller";
import { DeliveryReadinessService } from "./delivery-readiness.service";

@Module({
  controllers: [DeliveryReadinessController],
  providers: [DeliveryReadinessService],
  exports: [DeliveryReadinessService]
})
export class DeliveryReadinessModule {}
