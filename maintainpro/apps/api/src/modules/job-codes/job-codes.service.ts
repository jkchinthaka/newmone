import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

export interface CreateJobCodeInput {
  code: string;
  name: string;
  description?: string;
  category?: string;
  /** null or undefined = main job; ObjectId string = sub-job */
  parentId?: string | null;
  estimatedHours?: number | null;
  requiredSkills?: string[];
  requiredPartIds?: string[];
}

export interface UpdateJobCodeInput {
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  parentId?: string | null;
  estimatedHours?: number | null;
  requiredSkills?: string[];
  requiredPartIds?: string[];
  isActive?: boolean;
}

@Injectable()
export class JobCodesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    tenantId: string | null,
    params: {
      q?: string;
      /** "null" = main jobs only; an ObjectId = sub-jobs of that parent; undefined = all */
      parentId?: string | "null";
      pageSize?: number;
      includeInactive?: boolean;
    } = {}
  ) {
    const q = params.q?.trim();
    const take = Math.min(Math.max(params.pageSize ?? 100, 1), 200);

    const parentFilter =
      params.parentId === undefined
        ? {}
        : params.parentId === "null"
          ? { parentId: null }
          : { parentId: params.parentId };

    return this.prisma.jobCode.findMany({
      where: {
        tenantId: tenantId ?? null,
        isActive: params.includeInactive ? undefined : true,
        ...parentFilter,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { name: { contains: q, mode: "insensitive" as const } },
                { category: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { subJobs: true } }
      },
      orderBy: [{ category: "asc" }, { code: "asc" }],
      take
    });
  }

  async findOne(tenantId: string | null, id: string) {
    const job = await this.prisma.jobCode.findFirst({
      where: { id, tenantId: tenantId ?? null },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        subJobs: { where: { isActive: true }, orderBy: { code: "asc" } }
      }
    });
    if (!job) throw new NotFoundException("Job code not found");
    return job;
  }

  async create(tenantId: string | null, input: CreateJobCodeInput) {
    const code = input.code.trim();
    const name = input.name.trim();
    if (!code) throw new BadRequestException("`code` is required");
    if (!name) throw new BadRequestException("`name` is required");

    if (input.parentId) {
      const parent = await this.prisma.jobCode.findFirst({ where: { id: input.parentId, tenantId: tenantId ?? null } });
      if (!parent) throw new BadRequestException("Parent job code not found");
      if (parent.parentId) throw new BadRequestException("Sub-jobs cannot be nested more than one level deep");
    }

    return this.prisma.jobCode.create({
      data: {
        tenantId: tenantId ?? null,
        code,
        name,
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        parentId: input.parentId || null,
        estimatedHours: input.estimatedHours ?? null,
        requiredSkills: input.requiredSkills ?? [],
        requiredPartIds: input.requiredPartIds ?? []
      }
    });
  }

  async update(tenantId: string | null, id: string, input: UpdateJobCodeInput) {
    const existing = await this.prisma.jobCode.findFirst({ where: { id, tenantId: tenantId ?? null } });
    if (!existing) throw new NotFoundException("Job code not found");

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) throw new BadRequestException("A job cannot be its own parent");
      const parent = await this.prisma.jobCode.findFirst({ where: { id: input.parentId, tenantId: tenantId ?? null } });
      if (!parent) throw new BadRequestException("Parent job code not found");
      if (parent.parentId) throw new BadRequestException("Sub-jobs cannot be nested more than one level deep");
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code.trim();
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.category !== undefined) data.category = input.category?.trim() || null;
    if (input.parentId !== undefined) data.parentId = input.parentId || null;
    if (input.estimatedHours !== undefined) data.estimatedHours = input.estimatedHours;
    if (input.requiredSkills !== undefined) data.requiredSkills = input.requiredSkills;
    if (input.requiredPartIds !== undefined) data.requiredPartIds = input.requiredPartIds;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return this.prisma.jobCode.update({ where: { id }, data });
  }

  async remove(tenantId: string | null, id: string) {
    const existing = await this.prisma.jobCode.findFirst({ where: { id, tenantId: tenantId ?? null } });
    if (!existing) throw new NotFoundException("Job code not found");
    // Soft-delete: deactivate instead of hard delete to preserve history
    return this.prisma.jobCode.update({ where: { id }, data: { isActive: false } });
  }
}

