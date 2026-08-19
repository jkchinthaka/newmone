import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleName } from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { canUserReview } from "../policies/work-order-policies";
import { assertPolicy } from "../policies/policy-decision";

type Actor = Pick<JwtPayload, "sub" | "role" | "tenantId">;

export type ExceptionUpsertInput = {
  tenantId: string;
  ruleCode: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  entityType: string;
  entityId: string;
  module: string;
  messageCode: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertOpen(input: ExceptionUpsertInput) {
    const fingerprint = `OPEN:${input.ruleCode}:${input.entityType}:${input.entityId}`;
    const existing = await this.prisma.businessException.findUnique({
      where: { tenantId_fingerprint: { tenantId: input.tenantId, fingerprint } }
    });
    if (existing) {
      return this.prisma.businessException.update({
        where: { id: existing.id },
        data: {
          severity: input.severity,
          metadata: input.metadata as Prisma.InputJsonValue,
          messageCode: input.messageCode
        }
      });
    }
    try {
      return await this.prisma.businessException.create({
        data: {
          tenantId: input.tenantId,
          ruleCode: input.ruleCode,
          severity: input.severity,
          entityType: input.entityType,
          entityId: input.entityId,
          module: input.module,
          fingerprint,
          messageCode: input.messageCode,
          metadata: input.metadata as Prisma.InputJsonValue,
          status: "OPEN"
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.businessException.findUniqueOrThrow({
          where: { tenantId_fingerprint: { tenantId: input.tenantId, fingerprint } }
        });
      }
      throw error;
    }
  }

  async list(
    actor: Actor,
    query: { status?: string; severity?: string; module?: string; page?: number; pageSize?: number }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where: Prisma.BusinessExceptionWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.module ? { module: query.module } : {})
    };
    const [total, items] = await Promise.all([
      this.prisma.businessException.count({ where }),
      this.prisma.businessException.findMany({
        where,
        orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);
    const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    items.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));
    return { items, total, page, pageSize };
  }

  async get(id: string, actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.businessException.findFirst({ where: { id, tenantId } });
    if (!row) {
      throw new NotFoundException("Exception not found");
    }
    return row;
  }

  async resolve(
    id: string,
    actor: Actor,
    data: { status: "RESOLVED" | "IGNORED_WITH_REASON" | "INVESTIGATING"; resolution: string }
  ) {
    assertPolicy(canUserReview({ tenantId: actor.tenantId, role: actor.role }));
    if (!data.resolution?.trim() || data.resolution.trim().length < 3) {
      throw new BadRequestException("Resolution reason is required");
    }
    const existing = await this.get(id, actor);
    const nextFingerprint =
      data.status === "INVESTIGATING"
        ? existing.fingerprint
        : `${data.status}:${existing.ruleCode}:${existing.entityType}:${existing.entityId}:${existing.id}`;
    const updated = await this.prisma.businessException.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        resolution: data.resolution.trim(),
        resolvedById: data.status === "INVESTIGATING" ? undefined : actor.sub,
        resolvedAt: data.status === "INVESTIGATING" ? undefined : new Date(),
        fingerprint: nextFingerprint
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "BusinessException",
      entityId: existing.id,
      action: AuditAction.UPDATE,
      module: "data-quality",
      reason: data.resolution,
      metadata: { event: "exception_status", status: data.status } as Prisma.InputJsonValue,
      beforeData: existing as unknown as Prisma.InputJsonValue,
      afterData: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async scanTenant(tenantId: string) {
    const created: string[] = [];
    const balances = await this.prisma.warehouseItemBalance.findMany({
      where: { tenantId },
      take: 500
    });
    for (const balance of balances) {
      if (balance.reserved > balance.onHand || balance.available < 0 || balance.onHand < 0) {
        const row = await this.upsertOpen({
          tenantId,
          ruleCode: "RESERVED_EXCEEDS_ON_HAND",
          severity: "CRITICAL",
          entityType: "WarehouseItemBalance",
          entityId: balance.id,
          module: "inventory",
          messageCode: "RESERVED_EXCEEDS_ON_HAND",
          metadata: { onHand: balance.onHand, reserved: balance.reserved, available: balance.available }
        });
        created.push(row.id);
      }
    }

    const openVariances = await this.prisma.erpReconciliationMismatch.findMany({
      where: { tenantId, status: "OPEN", reportType: "stock_balances" },
      take: 200
    });
    for (const row of openVariances) {
      const createdRow = await this.upsertOpen({
        tenantId,
        ruleCode: "ERP_RECONCILIATION_VARIANCE",
        severity: row.severity === "HIGH" || row.severity === "CRITICAL" ? "HIGH" : "MEDIUM",
        entityType: "ErpReconciliationMismatch",
        entityId: row.id,
        module: "erp",
        messageCode: "ERP_RECONCILIATION_VARIANCE",
        metadata: { variance: row.variance, partId: row.partId }
      });
      created.push(createdRow.id);
    }

    return { scanned: balances.length + openVariances.length, upserted: created.length };
  }

  managerRoles(): RoleName[] {
    return [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.MANAGER, RoleName.OPERATIONS_MANAGER];
  }
}
