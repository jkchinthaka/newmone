import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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

  @Get("permissions")
  @Roles("SUPER_ADMIN", "ADMIN")
  async permissions() {
    const permissions = await this.rolesService.permissions();
    return { data: permissions, message: "Permissions fetched" };
  }

  @Post("permissions")
  @Roles("SUPER_ADMIN", "ADMIN")
  async createPermission(@Body() body: { key: string; description?: string }) {
    const permission = await this.rolesService.createPermission(body);
    return { data: permission, message: "Permission created" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN")
  async create(
    @Body()
    body: {
      name: string;
      tenantId?: string | null;
      permissionIds?: string[];
    }
  ) {
    const role = await this.rolesService.create(body);
    return { data: role, message: "Role created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async update(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      permissionIds?: string[];
    }
  ) {
    const role = await this.rolesService.update(id, body);
    return { data: role, message: "Role updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const deleted = await this.rolesService.remove(id);
    return { data: deleted, message: "Role deleted" };
  }
}
