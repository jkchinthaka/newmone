import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { PlatformScoped } from "../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ReplicationSyncService } from "./replication-sync.service";

@ApiTags("Database Replication")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin/replication")
export class ReplicationAdminController {
  constructor(private readonly replicationSyncService: ReplicationSyncService) {}

  @Get("status")
  @PlatformScoped()
  @Roles("SUPER_ADMIN")
  @Permissions("settings.system.manage")
  async status() {
    return {
      data: await this.replicationSyncService.getStatusSnapshot(),
      message: "Database replication status fetched"
    };
  }
}