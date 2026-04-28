import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

import type { JwtPayload } from "../auth/auth.types";

interface ListAuditQuery {
  entity?: string;
  entityId?: string;
  actorId?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: JwtPayload, query: ListAuditQuery) {
    const tenantId = actor.tenantId ?? null;
    const page = Math.max(1, Number.isFinite(query.page) ? query.page : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.isFinite(query.pageSize) ? query.pageSize : 20)
    );

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async forEntity(
    actor: JwtPayload,
    entity: string,
    entityId: string,
    page = 1,
    pageSize = 50
  ) {
    if (!entity || !entityId) {
      throw new NotFoundException("entity and entityId are required");
    }
    return this.list(actor, { entity, entityId, page, pageSize });
  }
}
