import { Body, Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UsersService } from "../users/users.service";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminAccessController {
  constructor(private readonly usersService: UsersService) {}

  @Get("users")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async listUsersForAccessReview() {
    const users = await this.usersService.findAllForAdminAccessView();
    return { data: users, message: "Admin user access list fetched" };
  }
}
