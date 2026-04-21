import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesService } from "./roles.service";

@ApiTags("Roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN")
  async findAll() {
    const roles = await this.rolesService.findAll();
    return { data: roles, message: "Roles fetched" };
  }
}
