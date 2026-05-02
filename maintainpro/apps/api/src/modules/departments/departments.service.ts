import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

export interface CreateDepartmentInput {
  name: string;
  code: string;
  description?: string;
  parentId?: string | null;
  managerId?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  description?: string;
  parentId?: string | null;
  managerId?: string | null;
  isActive?: boolean;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    tenantId: string | null,
    params: { q?: string; parentId?: string | "null"; pageSize?: number; includeInactive?: boolean } = {}
  ) {
    const q = params.q?.trim();
    const take = Math.min(Math.max(params.pageSize ?? 100, 1), 200);

    // ?parentId=null → top-level depts; ?parentId=<id> → children of that dept; omitted → all
    const parentFilter =
      params.parentId === undefined
        ? {}
        : params.parentId === "null"
          ? { parentId: null }
          : { parentId: params.parentId };

    return this.prisma.department.findMany({
      where: {
        tenantId: tenantId ?? null,
        isActive: params.includeInactive ? undefined : true,
        ...parentFilter,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { children: true, assets: true, vehicles: true, drivers: true, users: true } }
      },
      orderBy: { name: "asc" },
      take
    });
  }

  async findOne(tenantId: string | null, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId: tenantId ?? null },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        children: { select: { id: true, name: true, code: true, isActive: true }, orderBy: { name: "asc" } },
        _count: { select: { assets: true, vehicles: true, drivers: true, users: true } }
      }
    });
    if (!dept) throw new NotFoundException("Department not found");
    return dept;
  }

  async create(tenantId: string | null, input: CreateDepartmentInput) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    if (!code) throw new BadRequestException("`code` is required");
    if (!name) throw new BadRequestException("`name` is required");

    // Prevent circular self-reference
    if (input.parentId) {
      await this.assertNotAncestor(tenantId, input.parentId, input.parentId);
    }

    return this.prisma.department.create({
      data: {
        tenantId: tenantId ?? null,
        name,
        code,
        description: input.description?.trim() || null,
        parentId: input.parentId || null,
        managerId: input.managerId || null
      }
    });
  }

  async update(tenantId: string | null, id: string, input: UpdateDepartmentInput) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId: tenantId ?? null } });
    if (!existing) throw new NotFoundException("Department not found");

    // Prevent cycles if parentId is being changed
    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== existing.parentId) {
      await this.assertNotAncestor(tenantId, id, input.parentId);
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = input.code.trim().toUpperCase();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.parentId !== undefined) data.parentId = input.parentId || null;
    if (input.managerId !== undefined) data.managerId = input.managerId || null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.department.update({ where: { id }, data });
  }

  async deactivate(tenantId: string | null, id: string) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId: tenantId ?? null } });
    if (!existing) throw new NotFoundException("Department not found");
    return this.prisma.department.update({ where: { id }, data: { isActive: false } });
  }

  /** Verify that `candidateAncestorId` is NOT already a descendant of `id` (prevents cycles). */
  private async assertNotAncestor(tenantId: string | null, id: string, candidateParentId: string) {
    if (id === candidateParentId) {
      throw new BadRequestException("A department cannot be its own parent");
    }
    // Walk up the ancestor chain of candidateParentId; if we hit `id` → cycle
    let cursor: string | null = candidateParentId;
    const visited = new Set<string>();
    while (cursor) {
      if (visited.has(cursor)) break; // safety
      visited.add(cursor);
      const row: { parentId: string | null } | null = await this.prisma.department.findFirst({
        where: { id: cursor, tenantId: tenantId ?? null },
        select: { parentId: true }
      });
      if (!row) break;
      if (row.parentId === id) {
        throw new BadRequestException("Setting this parent would create a circular hierarchy");
      }
      cursor = row.parentId;
    }
  }
}
