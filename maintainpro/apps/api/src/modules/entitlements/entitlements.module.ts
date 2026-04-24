import { Module } from "@nestjs/common";

import { EntitlementGuard } from "./entitlement.guard";
import { EntitlementsController } from "./entitlements.controller";
import { EntitlementsService } from "./entitlements.service";

@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService, EntitlementGuard],
  exports: [EntitlementsService, EntitlementGuard]
})
export class EntitlementsModule {}
