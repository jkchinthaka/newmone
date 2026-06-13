import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { UsersModule } from "../users/users.module";
import { AdminAccessController } from "./admin-access.controller";
import { AdminTenantsService } from "./admin-tenants.service";
import { AdminRolesService } from "./admin-roles.service";
import { AdminInvitationsService } from "./admin-invitations.service";

@Module({
  imports: [UsersModule, InvitationsModule, EntitlementsModule],
  controllers: [AdminAccessController],
  providers: [AdminTenantsService, AdminRolesService, AdminInvitationsService]
})
export class AdminModule {}
