import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { AdminAccessController } from "./admin-access.controller";
import { AdminTenantsService } from "./admin-tenants.service";
import { AdminRolesService } from "./admin-roles.service";
import { AdminInvitationsService } from "./admin-invitations.service";

@Module({
  imports: [UsersModule],
  controllers: [AdminAccessController],
  providers: [AdminTenantsService, AdminRolesService, AdminInvitationsService]
})
export class AdminModule {}
