import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module";
import { AdminAccessController } from "./admin-access.controller";
import { AdminTenantsService } from "./admin-tenants.service";
import { AdminRolesService } from "./admin-roles.service";

@Module({
  imports: [UsersModule],
  controllers: [AdminAccessController],
  providers: [AdminTenantsService, AdminRolesService]
})
export class AdminModule {}
