import { Injectable, NotFoundException } from "@nestjs/common";
import { Priority, Prisma, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { scoreVehicleHealth } from "../policies/health-score";
import { evaluatePartCompatibility, isWithinWarranty } from "../policies/parts-policies";
import { DataQualityService } from "./data-quality.service";
import { DomainNotificationService } from "./domain-notification.service";

type Actor = Pick<JwtPayload, "sub" | "role" | "tenantId">;

@Injectable()
export class WarrantyHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
    private readonly notifications: DomainNotificationService
  ) {}

  async listCompatibilities(actor: Actor, partId?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.partCompatibility.findMany({
      where: { tenantId, ...(partId ? { partId } : {}) },
      include: { part: { select: { partNumber: true, name: true } } },
      take: 200,
      orderBy: { updatedAt: "desc" }
    });
  }

  async upsertCompatibility(
    actor: Actor,
    data: {
      partId: string;
      vehicleType?: string;
      make?: string;
      vehicleModel?: string;
      engineCode?: string;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const part = await this.prisma.sparePart.findFirst({ where: { id: data.partId, tenantId } });
    if (!part) {
      throw new NotFoundException("Part not found");
    }
    return this.prisma.partCompatibility.create({
      data: {
        tenantId,
        partId: data.partId,
        vehicleType: data.vehicleType,
        make: data.make,
        vehicleModel: data.vehicleModel,
        engineCode: data.engineCode,
        notes: data.notes
      }
    });
  }

  async evaluateForVehicle(tenantId: string, partId: string, vehicleId?: string | null) {
    if (!vehicleId) {
      return { result: "UNKNOWN" as const, vehicle: null };
    }
    const [rules, vehicle] = await Promise.all([
      this.prisma.partCompatibility.findMany({ where: { tenantId, partId } }),
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } })
    ]);
    return {
      result: evaluatePartCompatibility(rules, vehicle),
      vehicle
    };
  }

  async recordInstall(input: {
    tenantId: string;
    partId: string;
    vehicleId: string;
    workOrderId?: string;
    installedMileage?: number | null;
    serialNumber?: string | null;
  }) {
    const part = await this.prisma.sparePart.findFirst({ where: { id: input.partId, tenantId: input.tenantId } });
    if (!part) {
      return null;
    }
    const installedAt = new Date();
    const warrantyExpiresAt = part.warrantyDays
      ? new Date(installedAt.getTime() + part.warrantyDays * 24 * 60 * 60 * 1000)
      : null;
    return this.prisma.installedPart.create({
      data: {
        tenantId: input.tenantId,
        partId: input.partId,
        vehicleId: input.vehicleId,
        workOrderId: input.workOrderId,
        serialNumber: input.serialNumber ?? undefined,
        installedAt,
        installedMileage: input.installedMileage ?? undefined,
        warrantyExpiresAt,
        warrantyMileage: part.warrantyMileage ?? undefined,
        supplierId: part.supplierId ?? undefined
      }
    });
  }

  async detectWarrantyAndRepeat(workOrder: {
    id: string;
    tenantId?: string | null;
    vehicleId?: string | null;
    type: WorkOrderType;
    taxonomyIssueId?: string | null;
    issueNameSnapshot?: string | null;
    completedDate?: Date | null;
  }) {
    const tenantId = workOrder.tenantId;
    if (!tenantId || !workOrder.vehicleId) {
      return;
    }
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: workOrder.vehicleId, tenantId } });
    if (!vehicle) {
      return;
    }
    const parts = await this.prisma.workOrderPart.findMany({ where: { workOrderId: workOrder.id } });
    for (const line of parts) {
      const previous = await this.prisma.installedPart.findFirst({
        where: {
          tenantId,
          vehicleId: workOrder.vehicleId,
          partId: line.partId,
          removedAt: null
        },
        orderBy: { installedAt: "desc" }
      });
      const failedAt = workOrder.completedDate ?? new Date();
      if (
        previous &&
        isWithinWarranty({
          installedAt: previous.installedAt,
          installedMileage: previous.installedMileage,
          warrantyExpiresAt: previous.warrantyExpiresAt,
          warrantyMileage: previous.warrantyMileage,
          failedAt,
          failedMileage: vehicle.currentMileage
        })
      ) {
        await this.dataQuality.upsertOpen({
          tenantId,
          ruleCode: "WARRANTY_CLAIM_POSSIBLE",
          severity: "HIGH",
          entityType: "InstalledPart",
          entityId: previous.id,
          module: "warranty",
          messageCode: "WARRANTY_CLAIM_POSSIBLE",
          metadata: { workOrderId: workOrder.id, partId: line.partId, vehicleId: vehicle.id }
        });
        await this.notifications.emit({
          type: "WARRANTY_CLAIM_POSSIBLE",
          tenantId,
          entityType: "InstalledPart",
          entityId: previous.id,
          severity: "WARNING",
          metadata: { workOrderId: workOrder.id, vehicleId: vehicle.id }
        });
      }
    }

    const windowStart = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000);
    const related = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        vehicleId: workOrder.vehicleId,
        createdAt: { gte: windowStart },
        OR: [
          workOrder.taxonomyIssueId ? { taxonomyIssueId: workOrder.taxonomyIssueId } : undefined,
          workOrder.issueNameSnapshot ? { issueNameSnapshot: workOrder.issueNameSnapshot } : undefined
        ].filter(Boolean) as Prisma.WorkOrderWhereInput[]
      },
      select: { id: true, woNumber: true, createdAt: true, actualCost: true }
    });
    if (related.length >= 4) {
      await this.dataQuality.upsertOpen({
        tenantId,
        ruleCode: "REPEAT_FAILURE",
        severity: "HIGH",
        entityType: "Vehicle",
        entityId: workOrder.vehicleId,
        module: "fleet",
        messageCode: "REPEAT_FAILURE",
        metadata: {
          count: related.length,
          workOrderIds: related.map((row) => row.id),
          component: workOrder.issueNameSnapshot ?? workOrder.taxonomyIssueId
        }
      });
      await this.notifications.emit({
        type: "REPEAT_FAILURE",
        tenantId,
        entityType: "Vehicle",
        entityId: workOrder.vehicleId,
        severity: "WARNING",
        metadata: { count: related.length, workOrderIds: related.map((row) => row.id) }
      });
    }
  }

  async listWarrantyOpportunities(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.businessException.findMany({
      where: { tenantId, ruleCode: "WARRANTY_CLAIM_POSSIBLE", status: { in: ["OPEN", "INVESTIGATING"] } },
      orderBy: { detectedAt: "desc" },
      take: 100
    });
  }

  async listInstalled(actor: Actor, vehicleId?: string) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.installedPart.findMany({
      where: { tenantId, ...(vehicleId ? { vehicleId } : {}) },
      include: { part: { select: { name: true, partNumber: true } } },
      orderBy: { installedAt: "desc" },
      take: 200
    });
  }

  async scoreVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      include: { workOrders: { where: { status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] } } } }
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    const now = Date.now();
    const overdueKm =
      vehicle.nextServiceMileage != null ? Math.max(0, vehicle.currentMileage - vehicle.nextServiceMileage) : null;
    const overdueDays = vehicle.nextServiceDate
      ? Math.max(0, (now - vehicle.nextServiceDate.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const [breakdowns, repairs, exceptions, insuranceDays] = await Promise.all([
      this.prisma.workOrder.count({
        where: { tenantId, vehicleId, type: WorkOrderType.EMERGENCY, createdAt: { gte: since } }
      }),
      this.prisma.workOrder.count({
        where: { tenantId, vehicleId, createdAt: { gte: since }, status: { not: WorkOrderStatus.CANCELLED } }
      }),
      this.prisma.businessException.count({
        where: { tenantId, entityId: vehicleId, ruleCode: { in: ["REPEAT_FAILURE", "METER_ROLLBACK"] }, status: "OPEN" }
      }),
      vehicle.insuranceExpiry
        ? (vehicle.insuranceExpiry.getTime() - now) / (24 * 60 * 60 * 1000)
        : null
    ]);
    const scored = scoreVehicleHealth({
      maintenanceOverdueKm: overdueKm,
      maintenanceOverdueDays: overdueDays,
      criticalOpenWorkOrders: vehicle.workOrders.filter((wo) => wo.priority === Priority.CRITICAL).length,
      recentBreakdowns90d: breakdowns,
      repeatFailures: exceptions,
      complianceExpiringDays: insuranceDays,
      complianceExpired: insuranceDays != null && insuranceDays < 0,
      availabilityBlocked: vehicle.status === "OUT_OF_SERVICE" || vehicle.status === "UNDER_MAINTENANCE",
      recentRepairCount90d: repairs
    });
    const snapshot = await this.prisma.vehicleHealthSnapshot.create({
      data: {
        tenantId,
        vehicleId,
        score: scored.score,
        band: scored.band,
        reasons: scored.reasons as Prisma.InputJsonValue,
        factors: scored.deductions as Prisma.InputJsonValue,
        coverage: scored.coverage
      }
    });
    return { ...scored, snapshotId: snapshot.id, registrationNo: vehicle.registrationNo };
  }

  async listHealth(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicles = await this.prisma.vehicle.findMany({ where: { tenantId }, select: { id: true }, take: 200 });
    const results = [];
    for (const vehicle of vehicles) {
      results.push(await this.scoreVehicle(tenantId, vehicle.id));
    }
    return results.sort((a, b) => a.score - b.score);
  }
}
