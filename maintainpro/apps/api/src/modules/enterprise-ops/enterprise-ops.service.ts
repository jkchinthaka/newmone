import { Injectable, Optional } from "@nestjs/common";
import { Priority, VehicleStatus, WorkOrderStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { CostAllocationService } from "./cost-allocation.service";
import { DataQualityService } from "./data-quality.service";
import { DomainNotificationService } from "./domain-notification.service";
import { PmForecastService } from "./pm-forecast.service";
import { ProcurementRecommendationService } from "./procurement-recommendation.service";
import { WarrantyHealthService } from "./warranty-health.service";
import { GovernanceService } from "./governance.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class EnterpriseOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
    private readonly notifications: DomainNotificationService,
    private readonly pmForecast: PmForecastService,
    private readonly costs: CostAllocationService,
    private readonly warrantyHealth: WarrantyHealthService,
    @Optional() private readonly procurement?: ProcurementRecommendationService,
    @Optional() private readonly governance?: GovernanceService
  ) {}

  async onWorkOrderTransition(workOrder: {
    id: string;
    tenantId?: string | null;
    status: any;
    priority: any;
    createdAt: Date;
    slaDeadline?: Date | null;
    type?: any;
    taxonomyIssueId?: string | null;
  }) {
    await this.governance?.onWorkOrderTransition(workOrder);
  }

  async onWorkOrderCompleted(workOrder: {
    id: string;
    tenantId?: string | null;
    type: any;
    scheduleId?: string | null;
    vehicleId?: string | null;
    completedDate?: Date | null;
    actualHours?: number | null;
    verificationStatus?: string | null;
    taxonomyIssueId?: string | null;
    issueNameSnapshot?: string | null;
  }, actor?: Actor) {
    await this.pmForecast.advanceOnWorkOrderCompleted(workOrder);
    await this.warrantyHealth.detectWarrantyAndRepeat(workOrder);
    if (workOrder.vehicleId && workOrder.tenantId) {
      await this.warrantyHealth.scoreVehicle(workOrder.tenantId, workOrder.vehicleId);
      const parts = await this.prisma.workOrderPart.findMany({ where: { workOrderId: workOrder.id } });
      for (const line of parts) {
        if (line.issuedQuantity > 0) {
          await this.warrantyHealth.recordInstall({
            tenantId: workOrder.tenantId,
            partId: line.partId,
            vehicleId: workOrder.vehicleId,
            workOrderId: workOrder.id,
            installedMileage: undefined
          });
        }
      }
    }
    if (actor?.tenantId) {
      await this.pmForecast.refreshForecasts(actor, 14);
      await this.procurement?.evaluate(actor);
    }
  }

  async onGateResult(input: {
    tenantId: string;
    vehicleId: string;
    movementId: string;
    blocked: boolean;
    override: boolean;
  }) {
    if (input.blocked && !input.override) {
      await this.notifications.emit({
        type: "GATE_BLOCKED",
        tenantId: input.tenantId,
        entityType: "VehicleGateMovement",
        entityId: input.movementId,
        severity: "CRITICAL",
        metadata: { vehicleId: input.vehicleId }
      });
    }
    if (input.override) {
      await this.notifications.emit({
        type: "GATE_OVERRIDE_USED",
        tenantId: input.tenantId,
        entityType: "VehicleGateMovement",
        entityId: input.movementId,
        severity: "WARNING",
        metadata: { vehicleId: input.vehicleId }
      });
    }
  }

  async onReconciliationVariance(input: {
    tenantId: string;
    mismatchId: string;
    variance: number;
  }) {
    await this.dataQuality.upsertOpen({
      tenantId: input.tenantId,
      ruleCode: "ERP_RECONCILIATION_VARIANCE",
      severity: Math.abs(input.variance) >= 10 ? "HIGH" : "MEDIUM",
      entityType: "ErpReconciliationMismatch",
      entityId: input.mismatchId,
      module: "erp",
      messageCode: "ERP_RECONCILIATION_VARIANCE",
      metadata: { variance: input.variance }
    });
    await this.notifications.emit({
      type: "RECONCILIATION_VARIANCE",
      tenantId: input.tenantId,
      entityType: "ErpReconciliationMismatch",
      entityId: input.mismatchId,
      severity: "WARNING",
      metadata: { variance: input.variance }
    });
  }

  async dashboard(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const sinceMonth = new Date();
    sinceMonth.setDate(1);
    sinceMonth.setHours(0, 0, 0, 0);

    const [vehicles, criticalVehicles, dueSoon, overdue, criticalWos, stockParts, outOfStock, exceptions, warranty, recommendations, variances, slaBreaches, monthCost] =
      await Promise.all([
      this.prisma.vehicle.count({ where: { tenantId, status: { not: VehicleStatus.DISPOSED } } }),
      this.prisma.vehicle.count({
        where: { tenantId, status: { in: [VehicleStatus.OUT_OF_SERVICE, VehicleStatus.UNDER_MAINTENANCE] } }
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          isActive: true,
          OR: [{ vehicle: { tenantId } }, { asset: { tenantId } }],
          nextDueDate: { lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), gte: new Date() }
        }
      }),
      this.prisma.maintenanceSchedule.count({
        where: {
          isActive: true,
          OR: [{ vehicle: { tenantId } }, { asset: { tenantId } }],
          nextDueDate: { lt: new Date() }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          priority: Priority.CRITICAL,
          status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] }
        }
      }),
      this.prisma.sparePart.findMany({
        where: { tenantId, isActive: true },
        select: { availableQuantity: true, reorderPoint: true, minimumStock: true }
      }),
      this.prisma.sparePart.count({ where: { tenantId, isActive: true, availableQuantity: { lte: 0 } } }),
      this.prisma.businessException.count({ where: { tenantId, status: "OPEN" } }),
      this.prisma.businessException.count({
        where: { tenantId, ruleCode: "WARRANTY_CLAIM_POSSIBLE", status: { in: ["OPEN", "INVESTIGATING"] } }
      }),
      this.prisma.procurementRecommendation.count({ where: { tenantId, status: "OPEN" } }),
      this.prisma.erpReconciliationMismatch.count({ where: { tenantId, status: "OPEN" } }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          slaBreached: true,
          status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] }
        }
      }),
      this.costs.summarizeFleet(actor, { start: sinceMonth })
    ]);
    const lowStock = stockParts.filter(
      (part) =>
        part.availableQuantity > 0 && part.availableQuantity <= Math.max(part.reorderPoint, part.minimumStock, 0)
    ).length;

    const available = await this.prisma.vehicle.count({
      where: { tenantId, status: VehicleStatus.AVAILABLE }
    });
    const fleetAvailability = vehicles > 0 ? available / vehicles : null;
    const monthlyFleetCost = monthCost.reduce((sum, row) => sum + row.totalOperatingCost, 0);
    const forecastShortages = await this.prisma.procurementRecommendation.count({
      where: { tenantId, status: "OPEN", priority: "FORECAST_SHORTAGE" }
    });

    return {
      fleetAvailability: fleetAvailability == null ? { value: null, coverage: "INSUFFICIENT_DATA" } : { value: fleetAvailability, coverage: "COMPLETE" },
      criticalVehicles: { value: criticalVehicles, href: "/vehicles/health" },
      maintenanceDue: { value: dueSoon, href: "/maintenance/forecast" },
      maintenanceOverdue: { value: overdue, href: "/maintenance/forecast" },
      openCriticalWorkOrders: { value: criticalWos, href: "/work-orders" },
      lowStock: { value: lowStock, href: "/inventory" },
      outOfStock: { value: outOfStock, href: "/inventory" },
      forecastShortages: { value: forecastShortages, href: "/procurement/recommendations" },
      erpVariances: { value: variances, href: "/erp/reconciliation" },
      openExceptions: { value: exceptions, href: "/operations/exceptions" },
      warrantyOpportunities: { value: warranty, href: "/inventory/warranty" },
      procurementRecommendations: { value: recommendations, href: "/procurement/recommendations" },
      slaBreaches: { value: slaBreaches, href: "/operations/sla" },
      monthlyFleetCost: { value: monthlyFleetCost, href: "/vehicles/costs", coverage: monthCost.some((row) => row.coverage === "COMPLETE") ? "COMPLETE" : "INSUFFICIENT_DATA" }
    };
  }
}
