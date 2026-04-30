import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN")
  async findAll(
    @Query("q") q?: string,
    @Query("pageSize") pageSize?: string,
    @Query("roleName") roleName?: string
  ) {
    const users = await this.usersService.findAll({
      q,
      roleName,
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data: users, message: "Users fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async findOne(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    return { data: user, message: "User fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN")
  async create(@Body() body: { email: string; passwordHash: string; firstName: string; lastName: string; roleId: string; phone?: string }) {
    const user = await this.usersService.create(body);
    return { data: user, message: "User created" };
  }

  @Post("invite")
  @Roles("SUPER_ADMIN", "ADMIN")
  async invite(
    @Body()
    body: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      phone?: string;
    }
  ) {
    const user = await this.usersService.invite(body);
    return { data: user, message: "User invited" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async update(@Param("id") id: string, @Body() body: Partial<{ firstName: string; lastName: string; phone: string; roleId: string }>) {
    const user = await this.usersService.update(id, body);
    return { data: user, message: "User updated" };
  }

  @Patch(":id/status")
  @Roles("SUPER_ADMIN", "ADMIN")
  async updateStatus(@Param("id") id: string, @Body() body: { isActive: boolean }) {
    const user = await this.usersService.setActive(id, body.isActive);
    return { data: user, message: "User status updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const deleted = await this.usersService.remove(id);
    return { data: deleted, message: "User deleted" };
  }
}
