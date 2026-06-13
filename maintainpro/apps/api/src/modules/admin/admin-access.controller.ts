import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UpdateUserStatusDto } from "../users/dto/users.dto";
import { UsersService } from "../users/users.service";
import { AdminTenantsService } from "./admin-tenants.service";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminAccessController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminTenantsService: AdminTenantsService
  ) {}

  @Get("tenants")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async listTenantsForReview() {
    const tenants = await this.adminTenantsService.findAllForAdminTenantReview();
    return { data: tenants, message: "Admin tenant overview fetched" };
  }

  @Get("users")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async listUsersForAccessReview() {
    const users = await this.usersService.findAllForAdminAccessView();
    return { data: users, message: "Admin user access list fetched" };
  }

  @Patch("users/:id/status")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async updateUserStatus(@Param("id") id: string, @Body() body: UpdateUserStatusDto) {
    const user = await this.usersService.updateAdminUserStatus(id, body.isActive);
    return { data: user, message: "User status updated" };
  }
}
