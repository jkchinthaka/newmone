import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName, TenantMembershipRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto, InviteUserDto, UpdateUserDto } from "./dto/users.dto";

type UserRecord = { passwordHash: string };

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

  private toPublicUser<T extends UserRecord>(user: T): Omit<T, "passwordHash"> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

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
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true }
    });

    if (!role) {
      throw new BadRequestException("Role not found");
    }

    return role;
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
      include: { role: true },
      orderBy: { createdAt: "desc" },
      take
    });

    return users.map((user) => this.toPublicUser(user));
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
        role: { select: { name: true } },
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
    const actorId = requestContext.getActorId();
    const { tenantId, isSuperAdmin } = this.currentTenantScope();
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
        role: { select: { name: true } },
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

    return this.toAdminUserAccessRow(updated, isSuperAdmin);
  }

  private async findAdminMutationTarget(userId: string) {
    const { tenantId, isSuperAdmin } = this.currentTenantScope();

    return this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(!isSuperAdmin && tenantId ? { memberships: { some: { tenantId } } } : {})
      },
      include: {
        role: { select: { name: true } },
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
      role: { name: RoleName };
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
      include: { role: true }
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.toPublicUser(user);
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
          tenantId: tenantId ?? undefined
        },
        include: { role: true }
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

    return this.toPublicUser(user);
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
          tenantId: tenantId ?? undefined
        },
        include: {
          role: true
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

    return this.toPublicUser(user);
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
      include: { role: true }
    });

    return this.toPublicUser(user);
  }

  async setActive(id: string, isActive: boolean) {
    await this.assertTenantUserAccessOrThrow(id);
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { role: true }
    });

    return this.toPublicUser(user);
  }

  async remove(id: string) {
    await this.assertTenantUserAccessOrThrow(id);
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
}
