import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RoleName } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { PermissionOverridesService, type PermissionOverrideInput } from "./permission-overrides.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class PermissionOverridesController {
  constructor(private readonly permissionOverrides: PermissionOverridesService) {}

  @Get("users/:id/permission-overrides")
  @Roles(RoleName.SUPER_ADMIN)
  list(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.permissionOverrides.list(request.user, id);
  }

  @Post("users/:id/permission-overrides")
  @Roles(RoleName.SUPER_ADMIN)
  create(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Body() body: PermissionOverrideInput
  ) {
    return this.permissionOverrides.create(request.user, id, body);
  }

  @Delete("users/:id/permission-overrides")
  @Roles(RoleName.SUPER_ADMIN)
  remove(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Query("permissionKey") permissionKey = "",
    @Query("reason") reason = ""
  ) {
    return this.permissionOverrides.remove(request.user, id, permissionKey, reason);
  }
}
