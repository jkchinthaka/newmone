import { Module } from "@nestjs/common";

import { WorkOrderTaxonomyController } from "./work-order-taxonomy.controller";
import { WorkOrderTaxonomyService } from "./work-order-taxonomy.service";

@Module({
  controllers: [WorkOrderTaxonomyController],
  providers: [WorkOrderTaxonomyService],
  exports: [WorkOrderTaxonomyService]
})
export class WorkOrderTaxonomyModule {}
