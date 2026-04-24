import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { InvitationsController } from "./invitations.controller";
import { InvitationsService } from "./invitations.service";

@Module({
  imports: [TenancyModule, EntitlementsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService]
})
export class InvitationsModule {}
