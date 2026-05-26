import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CreateUserDto, InviteUserDto, UpdateUserDto, UpdateUserStatusDto } from "./dto/users.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions("users.view")
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
  @Permissions("users.view")
  async findOne(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    return { data: user, message: "User fetched" };
  }

  @Post()
  @Permissions("users.create")
  async create(@Body() body: CreateUserDto) {
    const user = await this.usersService.create(body);
    return { data: user, message: "User created" };
  }

  @Post("invite")
  @Permissions("users.create")
  async invite(
    @Body()
    body: InviteUserDto
  ) {
    const user = await this.usersService.invite(body);
    return { data: user, message: "User invited" };
  }

  @Patch(":id")
  @Permissions("users.edit")
  async update(@Param("id") id: string, @Body() body: UpdateUserDto) {
    const user = await this.usersService.update(id, body);
    return { data: user, message: "User updated" };
  }

  @Patch(":id/status")
  @Permissions("users.status.manage")
  async updateStatus(@Param("id") id: string, @Body() body: UpdateUserStatusDto) {
    const user = await this.usersService.setActive(id, body.isActive);
    return { data: user, message: "User status updated" };
  }

  @Delete(":id")
  @Permissions("users.delete")
  async remove(@Param("id") id: string) {
    const deleted = await this.usersService.remove(id);
    return { data: deleted, message: "User deleted" };
  }
}
