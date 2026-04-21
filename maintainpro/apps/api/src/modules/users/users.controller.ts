import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
  async findAll() {
    const users = await this.usersService.findAll();
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

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async update(@Param("id") id: string, @Body() body: Partial<{ firstName: string; lastName: string; phone: string; roleId: string }>) {
    const user = await this.usersService.update(id, body);
    return { data: user, message: "User updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async remove(@Param("id") id: string) {
    const deleted = await this.usersService.remove(id);
    return { data: deleted, message: "User deleted" };
  }
}
