import { BadRequestException, Injectable } from "@nestjs/common";
import { RoleName, WorkOrderStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { DATA_QUALITY_RULES } from "./admin-catalog";
import {
  evaluateHighImpactConfigChange,
  evaluateUserDeactivation,
  sanitizeSystemResponse
} from "./admin-safety";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

export type DataQualityIssue = {
  code: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  domain: string;
  entityType: string;
  entityId?: string;
  message: string;
  suggestedAction?: string;
  count?: number;
};

const OPEN_WO_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.OVERDUE,
  WorkOrderStatus.REWORK_REQUIRED
];

@Injectable()
export class AdminGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async previewDeactivate(actor: Actor, targetUserId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, memberships: { some: { tenantId } } },
      select: { id: true, isActive: true, role: { select: { name: true } } }
    });
    if (!target) {
      throw new BadRequestException("User not found");
    }
    const activeAdminCount = await this.prisma.user.count({
      where: {
        isActive: true,
        memberships: { some: { tenantId } },
        role: { name: { in: [RoleName.ADMIN, RoleName.SUPER_ADMIN] } }
      }
    });
    const openWork = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        technicianId: targetUserId,
        status: { in: OPEN_WO_STATUSES }
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

  async dataQualityIssues(actor: Actor): Promise<DataQualityIssue[]> {
    const tenantId = requireTenantId(actor.tenantId);
    const issues: DataQualityIssue[] = [];

    // BusinessException open/investigating entries aggregated by ruleCode
    const openExceptions = await this.prisma.businessException
      .groupBy({
        by: ["ruleCode", "severity"],
        where: { tenantId, status: { in: ["OPEN", "INVESTIGATING"] } },
        _count: { _all: true }
      })
      .catch(() => []);

    for (const ex of openExceptions) {
      const rule = DATA_QUALITY_RULES.find((r) => r.code === ex.ruleCode);
      if (rule) {
        issues.push({
          code: rule.code,
          severity: rule.severity,
          domain: rule.domain,
          entityType: rule.entityType,
          message: rule.message,
          suggestedAction: rule.suggestedAction,
          count: ex._count._all
        });
      }
    }

    // Vehicles without assetId (fleet not linked to asset registry)
    const vehiclesNoAsset = await this.prisma.vehicle
      .count({ where: { tenantId, assetId: null } })
      .catch(() => 0);
    if (vehiclesNoAsset > 0) {
      issues.push({
        code: "FLEET_NO_ASSET_LINK",
        severity: "WARNING",
        domain: "fleet",
        entityType: "Vehicle",
        message: "Vehicles not linked to asset registry",
        suggestedAction: "Link each vehicle to its corresponding asset record",
        count: vehiclesNoAsset
      });
    }

    // Active spare parts with no ERP code
    const unmappedParts = await this.prisma.sparePart
      .count({ where: { tenantId, isActive: true, erpCode: null } })
      .catch(() => 0);
    if (unmappedParts > 0) {
      issues.push({
        code: "ERP_UNMAPPED_PARTS",
        severity: "WARNING",
        domain: "erp",
        entityType: "SparePart",
        message: "Active spare parts with no ERP item code",
        suggestedAction: "Map spare parts to ERP item codes or mark as non-ERP items",
        count: unmappedParts
      });
    }

    return issues;
  }

  async overview(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);

    const [activeUsers, inactiveUsers, issues, pendingImports] = await Promise.all([
      this.prisma.user
        .count({ where: { isActive: true, memberships: { some: { tenantId } } } })
        .catch(() => 0),
      this.prisma.user
        .count({ where: { isActive: false, memberships: { some: { tenantId } } } })
        .catch(() => 0),
      this.dataQualityIssues(actor),
      this.prisma.bulkImportRun
        .count({ where: { tenantId, status: { in: ["UPLOADED", "VALIDATED"] } } })
        .catch(() => 0)
    ]);

    const issuesBySeverity = {
      CRITICAL: issues.filter((i) => i.severity === "CRITICAL").length,
      HIGH: issues.filter((i) => i.severity === "HIGH").length,
      WARNING: issues.filter((i) => i.severity === "WARNING").length,
      INFO: issues.filter((i) => i.severity === "INFO").length
    };

    return {
      users: { active: activeUsers, inactive: inactiveUsers, total: activeUsers + inactiveUsers },
      dataQuality: { issuesBySeverity, totalIssues: issues.length },
      pendingImports,
      rules: DATA_QUALITY_RULES.length
    };
  }

  systemInfo() {
    const raw = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? "unknown"
    };
    return sanitizeSystemResponse(raw as Record<string, unknown>);
  }
}
