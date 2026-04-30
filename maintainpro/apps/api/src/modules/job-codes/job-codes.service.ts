import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

export interface CreateJobCodeInput {
  code: string;
  name: string;
  description?: string;
  category?: string;
}

@Injectable()
export class JobCodesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string | null, params: { q?: string; pageSize?: number; includeInactive?: boolean } = {}) {
    const q = params.q?.trim();
    const take = Math.min(Math.max(params.pageSize ?? 100, 1), 200);
    return this.prisma.jobCode.findMany({
      where: {
        tenantId: tenantId ?? null,
        isActive: params.includeInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ category: "asc" }, { code: "asc" }],
      take
    });
  }

  create(tenantId: string | null, input: CreateJobCodeInput) {
    return this.prisma.jobCode.create({
      data: {
        tenantId: tenantId ?? null,
        code: input.code.trim(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null
      }
    });
  }

  async remove(tenantId: string | null, id: string) {
    const existing = await this.prisma.jobCode.findFirst({ where: { id, tenantId: tenantId ?? null } });
    if (!existing) {
      throw new NotFoundException("Job code not found");
    }
    return this.prisma.jobCode.delete({ where: { id } });
  }
}
