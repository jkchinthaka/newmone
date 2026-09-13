import { BadRequestException, Injectable } from "@nestjs/common";
import { RoleName, WorkOrderStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { DATA_QUALITY_RULES, MAINTENANCE_ADMIN_SECTIONS } from "./admin-catalog";
import {
  evaluateHighImpactConfigChange,
  evaluateUserDeactivation
} from "./admin-safety";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

@Injectable()
export class AdminGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  listSections(includeTechnical: boolean) {
    return MAINTENANCE_ADMIN_SECTIONS.filter((s) => includeTechnical || !s.technicalOnly);
  }

  async previewDeactivate(actor: Actor, targetUserId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      include: { role: true }
    });
    if (!target) {
      throw new BadRequestException("User not found");
    }
    const activeAdminCount = await this.prisma.user.count({
      where: {
        tenantId,
        isActive: true,
        role: { name: { in: [RoleName.ADMIN, RoleName.SUPER_ADMIN] } }
      }
    });
    const openWork = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        technicianId: targetUserId,
        status: {
          in: [
            WorkOrderStatus.OPEN,
            WorkOrderStatus.IN_PROGRESS,
            WorkOrderStatus.ON_HOLD,
            WorkOrderStatus.OVERDUE,
            WorkOrderStatus.REWORK_REQUIRED
          ]
        }
      },
      select: { id: true },
      take: 100
    });
    return evaluateUserDeactivation({
      actorId: actor.sub,
      targetUserId,
      targetRole: target.role?.name ?? "VIEWER",
      targetIsActive: target.isActive,
      nextIsActive: false,
      activeAdminCount,
      openWorkOrderIds: openWork.map((w) => w.id)
    });
  }

  guardConfigChange(input: {
    confirmed: boolean;
    impactPreviewProvided: boolean;
    reason?: string;
    effectiveFrom?: string;
  }) {
    const decision = evaluateHighImpactConfigChange({
      confirmed: input.confirmed,
      impactPreviewProvided: input.impactPreviewProvided,
      reason: input.reason,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null
    });
    if (!decision.allowed) {
      throw new BadRequestException(decision.code);
    }
    return decision;
  }

  async dataQualityOverview(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const openExceptions = await this.prisma.businessException.groupBy({
      by: ["ruleCode", "severity"],
      where: { tenantId, status: { in: ["OPEN", "INVESTIGATING"] } },
      _count: { _all: true }
    });
    return {
      rules: DATA_QUALITY_RULES,
      openByRule: openExceptions,
      sections: this.listSections(true)
    };
  }
}
