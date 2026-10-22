import { Module } from "@nestjs/common";

import { EntitlementsModule } from "../entitlements/entitlements.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { RolesModule } from "../roles/roles.module";
import { UsersModule } from "../users/users.module";
import { AdminAccessController } from "./admin-access.controller";
import { PermissionOverridesController } from "./permission-overrides.controller";
import { PermissionOverridesService } from "./permission-overrides.service";
import { AdminTenantsService } from "./admin-tenants.service";
import { AdminRolesService } from "./admin-roles.service";
import { AdminInvitationsService } from "./admin-invitations.service";

@Module({
  imports: [UsersModule, InvitationsModule, EntitlementsModule, RolesModule],
  controllers: [AdminAccessController, PermissionOverridesController],
  providers: [AdminTenantsService, AdminRolesService, AdminInvitationsService, PermissionOverridesService]
})
export class AdminModule {}
