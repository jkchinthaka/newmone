import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

export type PublicPermissionSummary = {
  id: string;
  key: string;
  module: string;
  description: string | null;
};

export type PublicRoleResponse = {
  id: string;
  name: RoleName;
  permissionCount: number;
  permissions: PublicPermissionSummary[];
};

export type PublicPermissionResponse = {
  id: string;
  key: string;
  module: string;
  description: string | null;
};

export const PUBLIC_ROLE_RESPONSE_FIELDS = ["id", "name", "permissionCount", "permissions"] as const;

export const PUBLIC_PERMISSION_RESPONSE_FIELDS = ["id", "key", "module", "description"] as const;

export const PUBLIC_PERMISSION_SUMMARY_FIELDS = ["id", "key", "module", "description"] as const;

export const ROLES_LEGACY_SENSITIVE_FIELDS = [
  "passwordHash",
  "password",
  "refreshToken",
  "resetToken",
  "sessionToken",
  "users",
  "assignedUsers",
  "roleIds",
  "permissionIds",
  "secret",
  "token",
  "session",
  "tenantSecret"
] as const;

const ROLE_PERMISSION_LINKS_SELECT = {
  permissionLinks: {
    select: {
      permission: {
        select: {
          id: true,
          key: true,
          description: true
        }
      }
    },
    orderBy: { permission: { key: "asc" as const } }
  }
} as const;

type RoleWithPermissionLinks = {
  id: string;
  name: string;
  permissionLinks: Array<{
    permission: { id: string; key: string; description: string | null };
  }>;
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PublicRoleResponse[]> {
    const roles = await this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        ...ROLE_PERMISSION_LINKS_SELECT
      },
      orderBy: { name: "asc" }
    });

    return roles.map((role) => this.toPublicRoleResponse(role));
  }

  async permissions(): Promise<PublicPermissionResponse[]> {
    const permissions = await this.prisma.permission.findMany({
      select: {
        id: true,
        key: true,
        description: true
      },
      orderBy: { key: "asc" }
    });

    return permissions.map((permission) => this.toPublicPermissionResponse(permission));
  }

  private toPublicPermissionResponse(permission: {
    id: string;
    key: string;
    description: string | null;
  }): PublicPermissionResponse {
    return {
      id: permission.id,
      key: permission.key,
      module: this.permissionModule(permission.key),
      description: permission.description
    };
  }

  private toPublicPermissionSummary(permission: {
    id: string;
    key: string;
    description: string | null;
  }): PublicPermissionSummary {
    return this.toPublicPermissionResponse(permission);
  }

  private toPublicRoleResponse(role: RoleWithPermissionLinks): PublicRoleResponse {
    const permissions = role.permissionLinks.map((link) =>
      this.toPublicPermissionSummary(link.permission)
    );

    return {
      id: role.id,
      name: role.name as RoleName,
      permissionCount: permissions.length,
      permissions
    };
  }

  private permissionModule(key: string): string {
    const [module = "general"] = key.split(".");
    return module;
  }

  private async syncRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const uniquePermissionIds = [...new Set(permissionIds.filter(Boolean))];

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(uniquePermissionIds.length > 0
        ? [
            this.prisma.rolePermission.createMany({
              data: uniquePermissionIds.map((permissionId) => ({ roleId, permissionId }))
            })
          ]
        : [])
    ]);
  }

  private async findRoleForPublicResponse(id: string): Promise<PublicRoleResponse> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ...ROLE_PERMISSION_LINKS_SELECT
      }
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return this.toPublicRoleResponse(role);
  }

  async createPermission(data: { key: string; description?: string }) {
    const key = data.key.trim();

    if (!key) {
      throw new BadRequestException("Permission key is required");
    }

    const permission = await this.prisma.permission.create({
      data: {
        key,
        description: data.description
      },
      select: {
        id: true,
        key: true,
        description: true
      }
    });

    return this.toPublicPermissionResponse(permission);
  }

  async create(data: { name: string; tenantId?: string | null; permissionIds?: string[] }) {
    const roleName = this.toRoleName(data.name);

    const role = await this.prisma.role.create({
      data: {
        name: roleName,
        tenantId: data.tenantId ?? null
      },
      select: { id: true }
    });

    if (data.permissionIds?.length) {
      await this.syncRolePermissions(role.id, data.permissionIds);
    }

    return this.findRoleForPublicResponse(role.id);
  }

  async update(id: string, data: { name?: string; permissionIds?: string[] }) {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException("Role not found");
    }

    if (data.name) {
      await this.prisma.role.update({
        where: { id },
        data: { name: this.toRoleName(data.name) }
      });
    }

    if (data.permissionIds) {
      await this.syncRolePermissions(id, data.permissionIds);
    }

    return this.findRoleForPublicResponse(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true }
        }
      }
    });

    if (!existing) {
      throw new NotFoundException("Role not found");
    }

    if (existing.users.length > 0) {
      throw new BadRequestException("Cannot delete a role with assigned users");
    }

    await this.prisma.role.delete({ where: { id } });

    return { deleted: true };
  }

  private toRoleName(raw: string): RoleName {
    const normalized = raw.trim().toUpperCase();
    const valid = Object.values(RoleName) as string[];

    if (!valid.includes(normalized)) {
      throw new BadRequestException(`Invalid role name. Allowed values: ${valid.join(", ")}`);
    }

    return normalized as RoleName;
  }
}
