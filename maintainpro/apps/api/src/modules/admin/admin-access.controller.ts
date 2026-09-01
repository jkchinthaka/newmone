import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditAction, RoleName } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";

import { Roles } from "../../common/decorators/roles.decorator";
import { SkipTenantContext } from "../../common/decorators/skip-tenant-context.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { RequireEntitlement } from "../entitlements/entitlement.decorator";
import { EntitlementGuard } from "../entitlements/entitlement.guard";
import { RolesService } from "../roles/roles.service";
import { UpdateUserStatusDto } from "../users/dto/users.dto";
import { UsersService } from "../users/users.service";
import { CreateAdminInvitationDto } from "./dto/create-admin-invitation.dto";
import {
  CreateAdminUserDto,
  SetAdminUserPasswordDto,
  UpdateAdminUserDto,
  UpdateRolePermissionsDto
} from "./dto/admin-user-mutations.dto";
import { AdminTenantsService } from "./admin-tenants.service";
import { AdminRolesService } from "./admin-roles.service";
import { AdminInvitationsService } from "./admin-invitations.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminAccessController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly adminTenantsService: AdminTenantsService,
    private readonly adminRolesService: AdminRolesService,
    private readonly adminInvitationsService: AdminInvitationsService,
    private readonly prisma: PrismaService
  ) {}

  @Get("invitations")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async listInvitationsForReview() {
    const invitations = await this.adminInvitationsService.findAllForAdminInvitationReview();
    return { data: invitations, message: "Admin invitation review list fetched" };
  }

  @Post("invitations")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @RequireEntitlement("users.max", 1)
  @UseGuards(EntitlementGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createInvitationForReview(@Body() body: CreateAdminInvitationDto) {
    const invitation = await this.adminInvitationsService.createInvitationForAdminConsole(body);
    return { data: invitation, message: "Invitation created" };
  }

  @Get("roles-permissions")
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  async listRolesPermissionsMatrix() {
    const matrix = await this.adminRolesService.findRolesPermissionsMatrixForReview();
    return { data: matrix, message: "Admin roles and permissions matrix fetched" };
  }

  /**
   * Editable permission matrix. SUPER_ADMIN only (DB-authoritative) — this is
   * a strictly more sensitive action than the read-only review above.
   */
  @Patch("roles/:id/permissions")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async updateRolePermissions(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: UpdateRolePermissionsDto) {
    const before = await this.prisma.role.findUnique({ where: { id }, select: { permissionIds: true } });
    const role = await this.rolesService.update(id, { permissionIds: body.permissionIds });

    await writeAuditTrail(this.prisma, {
      entity: "Role",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "admin-roles",
      actor: req.user,
      reason: "Role permissions updated via Admin Console",
      metadata: { event: "ROLE_PERMISSIONS_UPDATED", roleName: role.name, permissionCount: body.permissionIds.length },
      beforeData: { permissionIds: before?.permissionIds ?? [] },
      afterData: { permissionIds: body.permissionIds }
    });

    return { data: role, message: "Role permissions updated" };
  }

  /**
   * Idempotent, additive-only permission-catalog sync. SUPER_ADMIN only.
   * Never removes/renames a key and never touches Role.permissionIds.
   */
  @Post("permissions/sync")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async syncPermissionCatalog(@Req() req: AuthedRequest) {
    const result = await this.adminRolesService.syncPermissionCatalog(req.user);
    return { data: result, message: `${result.createdCount} permission(s) created, ${result.existingCount} already present` };
  }

  @Get("tenants")
  @SkipTenantContext()
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

  @Get("users/:id")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async getUserForAdminConsole(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    return { data: user, message: "User fetched" };
  }

  @Post("users")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async createUser(@Req() req: AuthedRequest, @Body() body: CreateAdminUserDto) {
    const user = await this.usersService.createForAdminConsole(body, req.user);
    return { data: user, message: "User created" };
  }

  @Patch("users/:id")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async updateUser(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: UpdateAdminUserDto) {
    const user = await this.usersService.updateForAdminConsole(id, body, req.user);
    return { data: user, message: "User updated" };
  }

  @Patch("users/:id/password")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async setUserPassword(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: SetAdminUserPasswordDto) {
    const result = await this.usersService.setPasswordForAdminConsole(id, body, req.user);
    return { data: result, message: "Password updated" };
  }

  @Patch("users/:id/status")
  @Roles(RoleName.SUPER_ADMIN)
  @UseGuards(SuperAdminGuard)
  async updateUserStatus(@Param("id") id: string, @Body() body: UpdateUserStatusDto) {
    const user = await this.usersService.updateAdminUserStatus(id, body.isActive);
    return { data: user, message: "User status updated" };
  }
}
