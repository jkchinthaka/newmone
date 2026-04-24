import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: true
      }
    });
  }

  permissions() {
    return this.prisma.permission.findMany({
      orderBy: { key: "asc" }
    });
  }

  async createPermission(data: { key: string; description?: string }) {
    const key = data.key.trim();

    if (!key) {
      throw new BadRequestException("Permission key is required");
    }

    return this.prisma.permission.create({
      data: {
        key,
        description: data.description
      }
    });
  }

  async create(data: { name: string; tenantId?: string | null; permissionIds?: string[] }) {
    const roleName = this.toRoleName(data.name);

    return this.prisma.role.create({
      data: {
        name: roleName,
        tenantId: data.tenantId ?? null,
        permissions: data.permissionIds?.length
          ? {
              connect: data.permissionIds.map((id) => ({ id }))
            }
          : undefined
      },
      include: {
        permissions: true
      }
    });
  }

  async update(id: string, data: { name?: string; permissionIds?: string[] }) {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: true }
    });

    if (!existing) {
      throw new NotFoundException("Role not found");
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(data.name ? { name: this.toRoleName(data.name) } : {}),
        ...(data.permissionIds
          ? {
              permissions: {
                set: data.permissionIds.map((permissionId) => ({ id: permissionId }))
              }
            }
          : {})
      },
      include: {
        permissions: true
      }
    });
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
