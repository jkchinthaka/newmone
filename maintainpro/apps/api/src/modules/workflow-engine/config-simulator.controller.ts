import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { canTransition } from "../policies/state-machines";
import { WorkflowEngineService } from "../workflow-engine/workflow-engine.service";
import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Admin Simulators")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/simulators")
export class ConfigSimulatorController {
  constructor(
    private readonly workflows: WorkflowEngineService,
    private readonly prisma: PrismaService
  ) {}

  @Post("workflow-transition")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("admin.organization.manage")
  async simWorkflow(
    @Req() req: AuthedRequest,
    @Body() body: { fromStatus?: string; toStatus?: string; entityType?: string }
  ) {
    if (!body.fromStatus || !body.toStatus) {
      throw new BadRequestException("fromStatus and toStatus required");
    }
    try {
      const result = await this.workflows.assertTransition({
        tenantId: requireTenantId(req.user.tenantId),
        entityType: body.entityType ?? "WORK_ORDER",
        fromStatus: body.fromStatus,
        toStatus: body.toStatus
      });
      return { data: { allowed: true, ...result }, message: "Transition allowed" };
    } catch (err) {
      const decision = canTransition("WORK_ORDER", body.fromStatus, body.toStatus);
      return {
        data: { allowed: false, code: "INVALID_TRANSITION", decision },
        message: "Transition blocked"
      };
    }
  }

  @Get("config-dependencies")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR")
  @Permissions("admin.organization.manage")
  async dependencies(
    @Req() req: AuthedRequest,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string
  ) {
    const tenantId = requireTenantId(req.user.tenantId);
    if (!entityType || !entityId) {
      throw new BadRequestException("entityType and entityId required");
    }
    const deps: Array<{ type: string; count: number }> = [];
    if (entityType === "PrioritySlaRule") {
      const count = await this.prisma.workOrder.count({
        where: { tenantId, priority: { not: undefined as never } }
      });
      deps.push({ type: "WorkOrder(priority usage approx)", count });
    }
    if (entityType === "MaintenanceAnalysisCode") {
      const count = await this.prisma.workOrder.count({
        where: {
          tenantId,
          OR: [{ failureCodeId: entityId }, { causeCodeId: entityId }]
        }
      });
      deps.push({ type: "WorkOrder analysis code refs", count });
    }
    if (entityType === "WorkflowDefinition") {
      const count = await this.prisma.workOrder.count({
        where: { tenantId, workflowVersionId: { not: null } }
      });
      deps.push({ type: "WorkOrder workflowVersionId", count });
    }
    return {
      data: {
        entityType,
        entityId,
        canRetire: deps.every((d) => d.count === 0),
        dependencies: deps
      },
      message: "Configuration dependency check"
    };
  }

  @Post("repair-replace-evidence")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  @Permissions("assets.view")
  async repairReplace(
    @Req() req: AuthedRequest,
    @Body() body: { assetId?: string }
  ) {
    if (!body.assetId) throw new BadRequestException("assetId required");
    const tenantId = requireTenantId(req.user.tenantId);
    const asset = await this.prisma.asset.findFirst({
      where: { id: body.assetId, tenantId },
      select: {
        id: true,
        name: true,
        assetTag: true,
        criticalityLevel: true,
        commissionedAt: true
      }
    });
    if (!asset) throw new BadRequestException("Asset not found");

    const wos = await this.prisma.workOrder.findMany({
      where: { tenantId, assetId: body.assetId, status: { not: "CANCELLED" } },
      select: { actualCost: true, actualHours: true, createdAt: true, type: true, repeatFailureCandidate: true },
      take: 500
    });
    const downtime = await this.prisma.downtimeSegment.findMany({
      where: { tenantId, assetId: body.assetId },
      select: { estimatedLostHours: true, startedAt: true, endedAt: true }
    });

    const repairCost = wos.reduce((s, w) => s + Number(w.actualCost ?? 0), 0);
    const failureCount = wos.filter((w) => w.repeatFailureCandidate || w.type === "BREAKDOWN").length;
    const downtimeHours = downtime.reduce((s, d) => s + Number(d.estimatedLostHours ?? 0), 0);

    return {
      data: {
        asset,
        evidence: {
          workOrderCount: wos.length,
          lifetimeRepairCost: repairCost,
          breakdownOrRepeatCount: failureCount,
          estimatedDowntimeHours: downtimeHours,
          ageDays: asset.commissionedAt
            ? Math.floor((Date.now() - asset.commissionedAt.getTime()) / 86400000)
            : null
        },
        recommendation:
          "Decision support only — authorized owners decide repair vs replace. No automatic disposal."
      },
      message: "Repair vs replace evidence"
    };
  }
}
