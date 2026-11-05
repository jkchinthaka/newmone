import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";

const slug = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Master data for the change request: requester groups and the spare part category list. */
@Injectable()
export class RequesterGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups(tenantIdRaw: string | null, includeInactive = false) {
    const tenantId = requireTenantId(tenantIdRaw);
    const rows = await this.prisma.requesterGroup.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } }
    });
    return rows.map((g) => ({ ...g, members: g.members.map((m) => m.user) }));
  }

  async createGroup(tenantIdRaw: string | null, input: { name: string; description?: string; departmentId?: string | null; memberIds?: string[] }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Enter a group name.");
    const code = slug(name) || "GROUP";
    if (await this.prisma.requesterGroup.findFirst({ where: { tenantId, code } })) {
      throw new BadRequestException(`A group named "${name}" already exists.`);
    }
    const memberIds = await this.validUserIds(tenantId, input.memberIds ?? []);
    return this.prisma.requesterGroup.create({
      data: {
        tenantId,
        code,
        name,
        description: input.description?.trim() || null,
        departmentId: input.departmentId || null,
        members: { create: memberIds.map((userId) => ({ userId })) }
      }
    });
  }

  async updateGroup(tenantIdRaw: string | null, id: string, input: { name?: string; description?: string; departmentId?: string | null; isActive?: boolean; memberIds?: string[] }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const group = await this.prisma.requesterGroup.findFirst({ where: { id, tenantId } });
    if (!group) throw new NotFoundException("Requester group not found.");
    const memberIds = input.memberIds ? await this.validUserIds(tenantId, input.memberIds) : null;
    return this.prisma.$transaction(async (tx) => {
      if (memberIds) {
        await tx.requesterGroupMember.deleteMany({ where: { groupId: id } });
        if (memberIds.length) await tx.requesterGroupMember.createMany({ data: memberIds.map((userId) => ({ groupId: id, userId })) });
      }
      return tx.requesterGroup.update({
        where: { id },
        data: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
        }
      });
    });
  }

  /** Groups a person belongs to (used by approval policy later). */
  async groupIdsForUser(tenantIdRaw: string | null, userId: string) {
    const tenantId = requireTenantId(tenantIdRaw);
    const rows = await this.prisma.requesterGroupMember.findMany({ where: { userId, group: { tenantId, isActive: true } }, select: { groupId: true } });
    return rows.map((r) => r.groupId);
  }

  private async validUserIds(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [];
    const users = await this.prisma.user.findMany({ where: { id: { in: unique }, tenantId }, select: { id: true } });
    return users.map((u) => u.id);
  }

  async listPartCategories(tenantIdRaw: string | null, includeInactive = false) {
    const tenantId = requireTenantId(tenantIdRaw);
    await this.seedPartCategoriesFromParts(tenantId);
    return this.prisma.sparePartCategory.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async createPartCategory(tenantIdRaw: string | null, input: { name: string }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Enter a category name.");
    const existing = await this.prisma.sparePartCategory.findFirst({ where: { tenantId, name } });
    if (existing) {
      if (existing.isActive) throw new BadRequestException(`"${name}" already exists.`);
      return this.prisma.sparePartCategory.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return this.prisma.sparePartCategory.create({ data: { tenantId, name: name.slice(0, 100) } });
  }

  async updatePartCategory(tenantIdRaw: string | null, id: string, input: { name?: string; isActive?: boolean }) {
    const tenantId = requireTenantId(tenantIdRaw);
    const row = await this.prisma.sparePartCategory.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Category not found.");
    return this.prisma.sparePartCategory.update({
      where: { id },
      data: { ...(input.name?.trim() ? { name: input.name.trim().slice(0, 100) } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) }
    });
  }

  /** First open: turn the free-text categories already on parts into the master list. */
  private async seedPartCategoriesFromParts(tenantId: string) {
    if ((await this.prisma.sparePartCategory.count({ where: { tenantId } })) > 0) return;
    const parts = await this.prisma.sparePart.findMany({ where: { tenantId }, select: { category: true }, distinct: ["category"] });
    const names = [...new Set(parts.map((p) => p.category?.trim()).filter((c): c is string => !!c))];
    for (const name of names) {
      await this.prisma.sparePartCategory.create({ data: { tenantId, name } }).catch(() => undefined);
    }
  }
}
