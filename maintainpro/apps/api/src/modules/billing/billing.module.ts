import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [EntitlementsModule],
  controllers: [BillingController],
  providers: [BillingService]
})
export class BillingModule {}
