import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { buildCanonicalDepartmentSeed, createDepartmentCode, normalizeDepartmentName } from "./department-master-list";

export interface CreateDepartmentInput {
  name: string;
  code?: string;
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
  status?: "active" | "inactive" | "ACTIVE" | "INACTIVE";
}

@Injectable()
export class DepartmentsService {
  private readonly canonicalDepartmentsReady = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string | null,
    params: { q?: string; parentId?: string | "null"; pageSize?: number; includeInactive?: boolean; exclude?: string; ids?: string[] } = {}
  ) {
    await this.ensureCanonicalDepartments(tenantId);

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
        tenantId: requireTenantId(tenantId),
        id: params.ids?.length ? { in: params.ids } : params.exclude ? { not: params.exclude } : undefined,
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
      where: { id, tenantId: requireTenantId(tenantId) },
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
    const name = input.name.trim();

    if (!name) throw new BadRequestException("`name` is required");
    await this.assertUniqueName(tenantId, name);
    const code = await this.resolveCode(tenantId, name, input.code);

    if (input.parentId) await this.assertDepartmentExists(tenantId, input.parentId);

    return this.prisma.department.create({
      data: {
        tenantId: requireTenantId(tenantId),
        name,
        code,
        description: input.description?.trim() || null,
        parentId: input.parentId || null,
        managerId: input.managerId || null
      }
    });
  }

  async update(tenantId: string | null, id: string, input: UpdateDepartmentInput) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId: requireTenantId(tenantId) } });
    if (!existing) throw new NotFoundException("Department not found");

    // Prevent cycles if parentId is being changed
    if (input.parentId !== undefined && input.parentId !== null && input.parentId !== existing.parentId) {
      await this.assertNotAncestor(tenantId, id, input.parentId);
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException("`name` is required");
      await this.assertUniqueName(tenantId, name, id);
      data.name = name;
      if (input.code === undefined && !existing.code) {
        data.code = await this.resolveCode(tenantId, name, undefined, id);
      }
    }
    if (input.code !== undefined) {
      data.code = await this.resolveCode(tenantId, String(data.name ?? existing.name), input.code, id);
    }
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.parentId !== undefined) data.parentId = input.parentId || null;
    if (input.managerId !== undefined) data.managerId = input.managerId || null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.status !== undefined) data.isActive = String(input.status).toUpperCase() === "ACTIVE";

    return this.prisma.department.update({ where: { id }, data });
  }

  async deactivate(tenantId: string | null, id: string) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId: requireTenantId(tenantId) } });
    if (!existing) throw new NotFoundException("Department not found");
    return this.prisma.department.update({ where: { id }, data: { isActive: false } });
  }

  private async assertUniqueName(tenantId: string | null, name: string, excludeId?: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId: requireTenantId(tenantId) },
      select: { id: true, name: true }
    });
    const normalized = normalizeDepartmentName(name);
    const duplicate = departments.find((department) => department.id !== excludeId && normalizeDepartmentName(department.name) === normalized);
    if (duplicate) {
      throw new BadRequestException(`Department "${name}" already exists`);
    }
  }

  private async resolveCode(tenantId: string | null, name: string, inputCode?: string, excludeId?: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId: requireTenantId(tenantId) },
      select: { id: true, code: true }
    });
    const usedCodes = new Set(departments.filter((department) => department.id !== excludeId).map((department) => department.code.toUpperCase()));
    const code = inputCode?.trim() ? inputCode.trim().toUpperCase() : createDepartmentCode(name, usedCodes);
    if (usedCodes.has(code)) {
      throw new BadRequestException(`Department code "${code}" already exists`);
    }
    return code;
  }

  private async assertDepartmentExists(tenantId: string | null, id: string) {
    const department = await this.prisma.department.findFirst({ where: { id, tenantId: requireTenantId(tenantId) }, select: { id: true } });
    if (!department) throw new BadRequestException("Parent department not found");
  }

  private async ensureCanonicalDepartments(tenantId: string | null) {
    const cacheKey = tenantId ?? "__GLOBAL__";
    if (this.canonicalDepartmentsReady.has(cacheKey)) return;

    const departments = await this.prisma.department.findMany({
      where: { tenantId: requireTenantId(tenantId) },
      select: { id: true, name: true, code: true, isActive: true }
    });
    const byName = new Map(departments.map((department) => [normalizeDepartmentName(department.name), department]));
    const usedCodes = new Set(departments.map((department) => department.code.toUpperCase()));

    for (const department of buildCanonicalDepartmentSeed()) {
      const normalized = normalizeDepartmentName(department.name);
      const existing = byName.get(normalized);

      if (existing) {
        usedCodes.add(existing.code.toUpperCase());
        continue;
      }

      const nextCode = createDepartmentCode(department.name, usedCodes);
      usedCodes.add(nextCode.toUpperCase());

      try {
        await this.prisma.department.create({
          data: {
            tenantId: requireTenantId(tenantId),
            name: department.name,
            code: nextCode,
            isActive: true
          }
        });
      } catch (error) {
        // Concurrent requests may race on seed creation; unique conflicts are safe to ignore.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          throw error;
        }
      }
    }

    this.canonicalDepartmentsReady.add(cacheKey);
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
        where: { id: cursor, tenantId: requireTenantId(tenantId) },
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
