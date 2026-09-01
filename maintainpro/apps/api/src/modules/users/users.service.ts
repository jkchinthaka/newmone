import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, RoleName, TenantMembershipRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { CreateAdminUserDto, SetAdminUserPasswordDto, UpdateAdminUserDto } from "../admin/dto/admin-user-mutations.dto";
import { CreateUserDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type PublicUserResponse = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  tenantId: string | null;
  departmentId: string | null;
  designation: string | null;
  mustChangePassword: boolean;
  role: {
    id: string;
    name: RoleName;
  };
};

export const PUBLIC_USER_RESPONSE_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "isActive",
  "tenantId",
  "departmentId",
  "designation",
  "mustChangePassword",
  "role"
] as const;

export type AdminUserAccessRow = {
  id: string;
  displayName: string;
  email: string;
  roleName: string;
  tenantId: string | null;
  tenantName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ADMIN_USER_ACCESS_SENSITIVE_FIELDS = [
  "passwordHash",
  "password",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "failedLoginAttempts",
  "lockedUntil"
] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toPublicUserResponse(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    tenantId?: string | null;
    departmentId?: string | null;
    designation?: string | null;
    mustChangePassword?: boolean;
    role: { id: string; name: RoleName };
  }): PublicUserResponse {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      isActive: user.isActive,
      tenantId: user.tenantId ?? null,
      departmentId: user.departmentId ?? null,
      designation: user.designation ?? null,
      mustChangePassword: user.mustChangePassword ?? false,
      role: {
        id: user.role.id,
        name: user.role.name
      }
    };
  }

  private readonly userRoleSelect = { id: true, name: true } as const;

  private currentTenantScope(): { tenantId: string | null; isSuperAdmin: boolean } {
    const ctx = requestContext.get();
    const tenantId = ctx?.tenantId ?? null;
    const isSuperAdmin = ctx?.actorRole === RoleName.SUPER_ADMIN;
    return { tenantId, isSuperAdmin };
  }

  private requiredTenantIdForNonSuperAdmin(): string | null {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    if (!isSuperAdmin && !tenantId) {
      throw new BadRequestException("Tenant context is required");
    }
    return tenantId;
  }

  private async ensureRoleExists(roleId: string): Promise<{ id: string; name: RoleName }> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, tenantId: true }
    });

    if (!role) {
      throw new BadRequestException("Role not found");
    }

    // Cross-tenant FK validation: non-super-admins may only assign global roles
    // (tenantId null) or roles owned by the active tenant.
    if (!isSuperAdmin && role.tenantId && role.tenantId !== tenantId) {
      throw new BadRequestException("Role not found");
    }

    return { id: role.id, name: role.name };
  }

  private membershipRoleForRole(roleName: RoleName): TenantMembershipRole {
    if (roleName === RoleName.SUPER_ADMIN || roleName === RoleName.ADMIN) {
      return TenantMembershipRole.ADMIN;
    }
    return TenantMembershipRole.MEMBER;
  }

  private async assertTenantUserAccessOrThrow(userId: string): Promise<void> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    if (isSuperAdmin || !tenantId) {
      return;
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId
        }
      },
      select: { id: true }
    });

    if (!membership) {
      throw new NotFoundException("User not found");
    }
  }

  async findAll(params: { q?: string; pageSize?: number; roleName?: string } = {}) {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    if (!isSuperAdmin && !tenantId) {
      return [];
    }

    const q = params.q?.trim();
    const roleName = this.parseRoleName(params.roleName);
    const take = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } }
                ]
              }
            : {},
          roleName ? { role: { is: { name: roleName } } } : {},
          !isSuperAdmin && tenantId ? { memberships: { some: { tenantId } } } : {}
        ]
      },
      include: { role: { select: this.userRoleSelect } },
      orderBy: { createdAt: "desc" },
      take
    });

    return users.map((user) => this.toPublicUserResponse(user));
  }

  async findAllForAdminAccessView(): Promise<AdminUserAccessRow[]> {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    if (!isSuperAdmin && !tenantId) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        AND: [!isSuperAdmin && tenantId ? { memberships: { some: { tenantId } } } : {}]
      },
      include: {
        role: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true } },
        memberships: {
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            tenant: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return users.map((user) => this.toAdminUserAccessRow(user, isSuperAdmin));
  }

  async updateAdminUserStatus(userId: string, isActive: boolean): Promise<AdminUserAccessRow> {
    const { isSuperAdmin } = this.currentTenantScope();
    const updated = await this.applyProtectedUserStatusUpdate(userId, isActive);
    return this.toAdminUserAccessRow(updated, isSuperAdmin);
  }

  private async applyProtectedUserStatusUpdate(userId: string, isActive: boolean) {
    const actorId = requestContext.getActorId();
    const { isSuperAdmin } = this.currentTenantScope();
    const target = await this.findAdminMutationTarget(userId);

    if (!target) {
      throw new NotFoundException("User not found");
    }

    if (actorId && actorId === userId && !isActive) {
      throw new BadRequestException("You cannot deactivate your own account");
    }

    if (!isSuperAdmin && target.role.name === RoleName.SUPER_ADMIN) {
      throw new ForbiddenException("Administrators cannot modify super admin accounts");
    }

    if (!isActive && target.role.name === RoleName.SUPER_ADMIN) {
      const activeSuperAdminCount = await this.prisma.user.count({
        where: {
          isActive: true,
          role: { name: RoleName.SUPER_ADMIN }
        }
      });

      if (activeSuperAdminCount <= 1) {
        throw new BadRequestException("Cannot deactivate the last active super admin");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      include: {
        role: { select: this.userRoleSelect },
        tenant: { select: { id: true, name: true } },
        memberships: {
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            tenant: { select: { id: true, name: true } }
          }
        }
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: userId,
      action: AuditAction.UPDATE,
      module: "admin-users",
      reason: isActive ? "User reactivated" : "User deactivated",
      metadata: { event: "USER_STATUS_CHANGED", isActive }
    });

    return updated;
  }

  /** Throws if deactivating/reassigning-away-from/deleting this target would leave zero active SUPER_ADMIN accounts. */
  private async assertNotLastActiveSuperAdmin(target: { id: string; role: { name: RoleName } }) {
    if (target.role.name !== RoleName.SUPER_ADMIN) {
      return;
    }
    const activeSuperAdminCount = await this.prisma.user.count({
      where: { isActive: true, role: { name: RoleName.SUPER_ADMIN } }
    });
    if (activeSuperAdminCount <= 1) {
      throw new BadRequestException("Cannot remove the last active SUPER_ADMIN account's administration");
    }
  }

  private async findAdminMutationTarget(userId: string) {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();

    return this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(!isSuperAdmin && tenantId ? { memberships: { some: { tenantId } } } : {})
      },
      include: {
        role: { select: this.userRoleSelect },
        tenant: { select: { id: true, name: true } },
        memberships: {
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            tenant: { select: { id: true, name: true } }
          }
        }
      }
    });
  }

  private toAdminUserAccessRow(
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      tenantId: string | null;
      isActive: boolean;
      lastLogin: Date | null;
      createdAt: Date;
      updatedAt: Date;
      role: { id: string; name: RoleName };
      tenant: { id: string; name: string } | null;
      memberships: Array<{ tenant: { id: string; name: string } }>;
    },
    isSuperAdmin: boolean
  ): AdminUserAccessRow {
    const membershipTenant = user.memberships[0]?.tenant ?? null;
    const resolvedTenant = user.tenant ?? membershipTenant;

    return {
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      roleName: user.role.name,
      tenantId: isSuperAdmin ? resolvedTenant?.id ?? user.tenantId : user.tenantId ?? membershipTenant?.id ?? null,
      tenantName: isSuperAdmin ? resolvedTenant?.name ?? null : resolvedTenant?.name ?? null,
      isActive: user.isActive,
      lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private parseRoleName(value?: string): RoleName | undefined {
    const trimmed = value?.trim();

    if (!trimmed) {
      return undefined;
    }

    if ((Object.values(RoleName) as string[]).includes(trimmed)) {
      return trimmed as RoleName;
    }

    throw new BadRequestException(`Invalid roleName filter: ${trimmed}`);
  }

  async findOne(id: string) {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        ...(!isSuperAdmin && tenantId ? { memberships: { some: { tenantId } } } : {})
      },
      include: { role: { select: this.userRoleSelect } }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.toPublicUserResponse(user);
  }

  async create(data: CreateUserDto) {
    const tenantId = this.requiredTenantIdForNonSuperAdmin();
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const role = await this.ensureRoleExists(data.roleId);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          roleId: data.roleId,
          phone: data.phone?.trim() || undefined,
          tenantId: tenantId === null ? undefined : tenantId
        },
        include: { role: { select: this.userRoleSelect } }
      });

      if (tenantId) {
        await tx.tenantMembership.create({
          data: {
            tenantId,
            userId: created.id,
            membershipRole: this.membershipRoleForRole(role.name)
          }
        });
      }

      return created;
    });

    return this.toPublicUserResponse(user);
  }

  async invite(data: InviteUserDto) {
    const tenantId = this.requiredTenantIdForNonSuperAdmin();
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const role = await this.ensureRoleExists(data.roleId);

    const tempPassword = `Invite-${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          roleId: data.roleId,
          phone: data.phone?.trim() || undefined,
          passwordHash,
          isActive: true,
          tenantId: tenantId === null ? undefined : tenantId
        },
        include: {
          role: { select: this.userRoleSelect }
        }
      });

      if (tenantId) {
        await tx.tenantMembership.create({
          data: {
            tenantId,
            userId: created.id,
            membershipRole: this.membershipRoleForRole(role.name)
          }
        });
      }

      return created;
    });

    return this.toPublicUserResponse(user);
  }

  async update(id: string, data: UpdateUserDto) {
    await this.assertTenantUserAccessOrThrow(id);
    await this.findOne(id);

    if (data.roleId) {
      await this.ensureRoleExists(data.roleId);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        phone: data.phone?.trim() || undefined,
        roleId: data.roleId
      },
      include: { role: { select: this.userRoleSelect } }
    });

    return this.toPublicUserResponse(user);
  }

  async setActive(id: string, isActive: boolean) {
    const updated = await this.applyProtectedUserStatusUpdate(id, isActive);
    return this.toPublicUserResponse(updated);
  }

  async remove(id: string) {
    await this.assertTenantUserAccessOrThrow(id);
    const actorId = requestContext.getActorId();
    if (actorId && actorId === id) {
      throw new BadRequestException("You cannot delete your own account");
    }
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: { select: this.userRoleSelect } } });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    await this.assertNotLastActiveSuperAdmin(target);

    const { tenantId, isSuperAdmin } = this.currentTenantScope();
    const openWorkOrders = await this.prisma.workOrder.count({
      where: {
        technicianId: id,
        ...(!isSuperAdmin && tenantId ? { tenantId } : {}),
        status: {
          in: ["OPEN", "IN_PROGRESS", "ON_HOLD"]
        }
      }
    });

    if (openWorkOrders > 0) {
      throw new BadRequestException("Cannot delete user with assigned open work orders");
    }

    await this.prisma.user.delete({ where: { id } });

    return {
      deleted: true
    };
  }

  // ---------------------------------------------------------------------
  // Admin Console (SUPER_ADMIN-only) surface. Authorization is enforced by
  // SuperAdminGuard at the controller — these methods still apply the same
  // tenant/last-SUPER_ADMIN/self-action business protections as the
  // general-purpose methods above.
  // ---------------------------------------------------------------------

  private async assertTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isActive: true } });
    if (!tenant || !tenant.isActive) {
      throw new BadRequestException("Tenant not found or inactive");
    }
  }

  private async assertDepartmentExists(tenantId: string | null, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, ...(tenantId ? { tenantId } : {}) },
      select: { id: true }
    });
    if (!department) {
      throw new BadRequestException("Department not found for the selected tenant");
    }
  }

  async createForAdminConsole(dto: CreateAdminUserDto, actor: Actor) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new BadRequestException("Email already in use");
    }

    const role = await this.ensureRoleExists(dto.roleId);
    const tenantId = dto.tenantId ?? null;
    if (tenantId) {
      await this.assertTenantExists(tenantId);
    }
    if (dto.departmentId) {
      await this.assertDepartmentExists(tenantId, dto.departmentId);
    }

    const generatedPassword = dto.password ? null : `Tmp-${randomBytes(6).toString("hex")}A1!`;
    const passwordHash = await bcrypt.hash(dto.password ?? generatedPassword!, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || undefined,
          roleId: dto.roleId,
          tenantId: tenantId ?? undefined,
          departmentId: dto.departmentId ?? undefined,
          designation: dto.designation?.trim() || undefined,
          mustChangePassword: !dto.password
        },
        include: { role: { select: this.userRoleSelect }, tenant: { select: { id: true, name: true } } }
      });

      if (tenantId) {
        await tx.tenantMembership.create({
          data: { tenantId, userId: created.id, membershipRole: this.membershipRoleForRole(role.name) }
        });
      }

      return created;
    });

    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: user.id,
      action: AuditAction.CREATE,
      module: "admin-users",
      actor,
      reason: "User created via Admin Console",
      metadata: { event: "USER_CREATED", email, roleId: dto.roleId, tenantId, generatedTemporaryPassword: Boolean(generatedPassword) }
    });

    return { ...this.toPublicUserResponse(user), temporaryPassword: generatedPassword ?? undefined };
  }

  async updateForAdminConsole(id: string, dto: UpdateAdminUserDto, actor: Actor) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { select: this.userRoleSelect } }
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }

    let nextTenantId: string | null | undefined;
    if (dto.tenantId !== undefined) {
      await this.assertTenantExists(dto.tenantId);
      nextTenantId = dto.tenantId;
    }

    if (dto.departmentId !== undefined) {
      await this.assertDepartmentExists(nextTenantId ?? target.tenantId, dto.departmentId);
    }

    let normalizedEmail: string | undefined;
    if (dto.email) {
      normalizedEmail = dto.email.toLowerCase().trim();
      if (normalizedEmail !== target.email) {
        const emailTaken = await this.prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
        if (emailTaken) {
          throw new BadRequestException("Email already in use");
        }
      }
    }

    let nextRole: { id: string; name: RoleName } | undefined;
    if (dto.roleId && dto.roleId !== target.roleId) {
      nextRole = await this.ensureRoleExists(dto.roleId);
      if (target.role.name === RoleName.SUPER_ADMIN && nextRole.name !== RoleName.SUPER_ADMIN) {
        await this.assertNotLastActiveSuperAdmin(target);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        email: normalizedEmail,
        phone: dto.phone?.trim() || undefined,
        roleId: dto.roleId,
        tenantId: nextTenantId,
        departmentId: dto.departmentId,
        designation: dto.designation?.trim() || undefined
      },
      include: { role: { select: this.userRoleSelect } }
    });

    if (normalizedEmail && normalizedEmail !== target.email) {
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: id,
        action: AuditAction.UPDATE,
        module: "admin-users",
        actor,
        reason: "User email changed",
        metadata: { event: "USER_EMAIL_CHANGED" },
        beforeData: { email: target.email },
        afterData: { email: normalizedEmail }
      });
    }

    if (nextRole) {
      await writeAuditTrail(this.prisma, {
        entity: "User",
        entityId: id,
        action: AuditAction.UPDATE,
        module: "admin-users",
        actor,
        reason: "User role changed",
        metadata: { event: "USER_ROLE_CHANGED" },
        beforeData: { role: target.role.name },
        afterData: { role: nextRole.name }
      });
    }

    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "admin-users",
      actor,
      reason: "User updated via Admin Console",
      metadata: { event: "USER_UPDATED" }
    });

    return this.toPublicUserResponse(updated);
  }

  async setPasswordForAdminConsole(id: string, dto: SetAdminUserPasswordDto, actor: Actor) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      throw new NotFoundException("User not found");
    }

    const generatedPassword = dto.newPassword ? null : `Tmp-${randomBytes(6).toString("hex")}A1!`;
    const passwordHash = await bcrypt.hash(dto.newPassword ?? generatedPassword!, 12);
    const mustChangePassword = dto.mustChangePassword ?? true;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword,
          lastPasswordChangedAt: now,
          temporaryPasswordExpiresAt: mustChangePassword ? new Date(now.getTime() + 72 * 60 * 60 * 1000) : null,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      // Revoke existing sessions — mirrors AuthService.resetPassword's session-revocation pattern.
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now }
      });
    });

    // Never log/return the plaintext password or its hash.
    await writeAuditTrail(this.prisma, {
      entity: "User",
      entityId: id,
      action: AuditAction.UPDATE,
      module: "admin-users",
      actor,
      reason: "Password reset via Admin Console",
      metadata: { event: "USER_PASSWORD_RESET", mustChangePassword, sessionsRevoked: true }
    });

    return { updated: true, temporaryPassword: generatedPassword ?? undefined, mustChangePassword };
  }
}
