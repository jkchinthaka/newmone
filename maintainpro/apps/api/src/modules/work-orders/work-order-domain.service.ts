import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AssetStatus,
  AuditAction,
  Priority,
  VehicleStatus,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { parseJobDomain } from "../../common/utils/job-domain.util";
import {
  assertDomainReleaseAllowed,
  assertMonotonicMeterReading,
  displayOperationalStatus,
  formatAssetIdentity,
  formatLocationIdentity,
  formatVehicleIdentity
} from "../../common/utils/work-order-domain.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role">;

const OPEN_CRITICAL_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.PLANNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED
];

@Injectable()
export class WorkOrderDomainService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantId(actor?: Actor) {
    return requireTenantId(actor?.tenantId);
  }

  /**
   * On Start Work: mark linked Asset/Vehicle UNDER_MAINTENANCE when appropriate.
   * Never invent AVAILABLE for blank vehicle status.
   */
  async syncTargetUnderMaintenance(workOrderId: string, actor?: Actor) {
    const tenantId = this.tenantId(actor);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true, jobDomain: true, assetId: true, vehicleId: true, woNumber: true }
    });
    if (!wo) throw new NotFoundException("Work order not found");

    if (wo.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: wo.assetId, tenantId },
        select: { id: true, status: true }
      });
      if (!asset) throw new BadRequestException("Linked asset not found for this tenant.");
      this.assertTargetNotRetired(asset.status, "Asset");
      if (
        asset.status === AssetStatus.ACTIVE ||
        asset.status === AssetStatus.INACTIVE ||
        asset.status === AssetStatus.DRAFT ||
        !String(asset.status ?? "").trim()
      ) {
        await this.prisma.asset.update({
          where: { id: asset.id },
          data: { status: AssetStatus.UNDER_MAINTENANCE }
        });
        await this.auditTargetStatusChange({
          tenantId,
          workOrderId: wo.id,
          entity: "Asset",
          entityId: asset.id,
          before: asset.status ?? "",
          after: AssetStatus.UNDER_MAINTENANCE,
          actor,
          reason: `Start work on ${wo.woNumber}`
        });
      }
    }

    if (wo.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: wo.vehicleId, tenantId },
        select: { id: true, status: true }
      });
      if (!vehicle) throw new BadRequestException("Linked vehicle not found for this tenant.");
      const raw = String(vehicle.status ?? "").trim();
      if (vehicle.status === VehicleStatus.DISPOSED) {
        throw new BadRequestException("Cannot start work on a disposed vehicle.");
      }
      if (
        !raw ||
        vehicle.status === VehicleStatus.AVAILABLE ||
        vehicle.status === VehicleStatus.IN_USE
      ) {
        await this.prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { status: VehicleStatus.UNDER_MAINTENANCE }
        });
        await this.auditTargetStatusChange({
          tenantId,
          workOrderId: wo.id,
          entity: "Vehicle",
          entityId: vehicle.id,
          before: raw,
          after: VehicleStatus.UNDER_MAINTENANCE,
          actor,
          reason: raw
            ? `Start work on ${wo.woNumber}`
            : `Start work on ${wo.woNumber} (previous status not set)`
        });
      }
    }
  }

  async applyCompletionMeterReading(input: {
    workOrderId: string;
    reading: number;
    actor?: Actor;
  }) {
    const tenantId = this.tenantId(input.actor);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: input.workOrderId, tenantId },
      select: { id: true, jobDomain: true, assetId: true, vehicleId: true, woNumber: true }
    });
    if (!wo) throw new NotFoundException("Work order not found");

    const domain = parseJobDomain(wo.jobDomain);

    if (domain === "VEHICLE" || wo.vehicleId) {
      if (!wo.vehicleId) {
        throw new BadRequestException("Vehicle odometer requires a linked vehicle.");
      }
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: wo.vehicleId, tenantId },
        select: { id: true, currentMileage: true }
      });
      if (!vehicle) throw new BadRequestException("Linked vehicle not found.");

      assertMonotonicMeterReading({
        previous: vehicle.currentMileage,
        next: input.reading,
        label: "Odometer"
      });

      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { currentMileage: input.reading }
      });

      await this.prisma.vehicleMeterLog.create({
        data: {
          vehicleId: vehicle.id,
          reading: input.reading,
          readingType: "ODOMETER",
          source: "WORK_ORDER_COMPLETION",
          notes: `Recorded on ${wo.woNumber}`,
          recordedById: input.actor?.sub
        }
      });

      return { kind: "VEHICLE" as const, previous: vehicle.currentMileage, next: input.reading };
    }

    if (domain === "MACHINERY" || wo.assetId) {
      if (!wo.assetId) {
        throw new BadRequestException("Machine meter reading requires a linked asset.");
      }
      const asset = await this.prisma.asset.findFirst({
        where: { id: wo.assetId, tenantId },
        select: { id: true, meterReading: true }
      });
      if (!asset) throw new BadRequestException("Linked asset not found.");

      assertMonotonicMeterReading({
        previous: asset.meterReading,
        next: input.reading,
        label: "Meter reading"
      });

      await this.prisma.asset.update({
        where: { id: asset.id },
        data: { meterReading: input.reading }
      });

      const primaryMeter = await this.prisma.assetMeter.findFirst({
        where: { assetId: asset.id, tenantId, isActive: true },
        orderBy: { createdAt: "asc" }
      });
      if (primaryMeter) {
        await this.prisma.assetMeterReading.create({
          data: {
            tenantId,
            meterId: primaryMeter.id,
            value: input.reading,
            previousValue: asset.meterReading ?? primaryMeter.currentValue,
            source: "WORK_ORDER_COMPLETION",
            notes: `Recorded on ${wo.woNumber}`,
            recordedById: input.actor?.sub
          }
        });
        await this.prisma.assetMeter.update({
          where: { id: primaryMeter.id },
          data: { currentValue: input.reading, lastReadingAt: new Date() }
        });
      }

      return { kind: "ASSET" as const, previous: asset.meterReading, next: input.reading };
    }

    throw new BadRequestException("No meter/odometer target on this work order.");
  }

  async countCriticalOpenWorkOrders(input: {
    tenantId: string;
    vehicleId?: string | null;
    assetId?: string | null;
    excludeWorkOrderId: string;
  }) {
    const targetClauses: Array<{ vehicleId?: string; assetId?: string }> = [];
    if (input.vehicleId) targetClauses.push({ vehicleId: input.vehicleId });
    if (input.assetId) targetClauses.push({ assetId: input.assetId });
    if (targetClauses.length === 0) return 0;

    return this.prisma.workOrder.count({
      where: {
        tenantId: input.tenantId,
        id: { not: input.excludeWorkOrderId },
        status: { in: OPEN_CRITICAL_STATUSES },
        OR: [
          { priority: Priority.CRITICAL },
          { type: { in: [WorkOrderType.EMERGENCY, WorkOrderType.ACCIDENT_REPAIR] } },
          { accidentId: { not: null } }
        ],
        AND: [{ OR: targetClauses }]
      }
    });
  }

  /**
   * Authorized return-to-service after supervisor verification.
   * Technician completion alone never sets Vehicle AVAILABLE / Asset ACTIVE.
   */
  async returnToService(
    workOrderId: string,
    input: {
      note?: string;
      allowComplianceBlockedMaintenanceComplete?: boolean;
    },
    actor?: Actor
  ) {
    const tenantId = this.tenantId(actor);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        vehicle: {
          select: { id: true, status: true, complianceStatus: true, serviceStatus: true }
        },
        asset: { select: { id: true, status: true } }
      }
    });
    if (!wo) throw new NotFoundException("Work order not found");

    if (wo.status === WorkOrderStatus.TECHNICIAN_COMPLETED) {
      throw new BadRequestException(
        "Supervisor verification is required before return-to-service. Technician completion alone is not sufficient."
      );
    }

    if (wo.status !== WorkOrderStatus.VERIFIED && wo.status !== WorkOrderStatus.CLOSED) {
      throw new BadRequestException(
        "Return to service requires a verified (or already closed) work order."
      );
    }

    const criticalOpen = await this.countCriticalOpenWorkOrders({
      tenantId,
      vehicleId: wo.vehicleId,
      assetId: wo.assetId,
      excludeWorkOrderId: wo.id
    });

    const woExt = wo as typeof wo & {
      functionalTestResult?: string | null;
      roadTestResult?: string | null;
      operatingRestriction?: string | null;
    };

    const complianceBlocks =
      wo.vehicle != null &&
      String(wo.vehicle.complianceStatus ?? "")
        .toUpperCase()
        .includes("NON_COMPLIANT");

    const restrictedRelease = Boolean(
      wo.temporaryRepair || woExt.operatingRestriction?.trim()
    );

    assertDomainReleaseAllowed({
      jobDomain: wo.jobDomain,
      functionalTestResult: woExt.functionalTestResult,
      roadTestResult: woExt.roadTestResult,
      temporaryRepair: wo.temporaryRepair,
      operatingRestriction: woExt.operatingRestriction,
      criticalOpenWorkOrderCount: criticalOpen,
      complianceBlocksRoadRelease: complianceBlocks && !restrictedRelease,
      allowMaintenanceCompleteWhileComplianceBlocked: Boolean(
        input.allowComplianceBlockedMaintenanceComplete
      ),
      allowRestrictedRelease: restrictedRelease
    });

    const now = new Date();
    await this.prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        productionResumedAt: now,
        downtimeEndedAt: wo.downtimeEndedAt ?? now
      }
    });

    if (wo.assetId && wo.asset) {
      if (
        wo.asset.status === AssetStatus.UNDER_MAINTENANCE ||
        wo.asset.status === AssetStatus.OUT_OF_SERVICE
      ) {
        const nextAssetStatus = wo.temporaryRepair
          ? AssetStatus.OUT_OF_SERVICE
          : AssetStatus.ACTIVE;
        await this.prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: nextAssetStatus }
        });
        await this.auditTargetStatusChange({
          tenantId,
          workOrderId: wo.id,
          entity: "Asset",
          entityId: wo.assetId,
          before: wo.asset.status,
          after: nextAssetStatus,
          actor,
          reason: input.note?.trim() || `Return to service after ${wo.woNumber}`
        });
      }
    }

    if (wo.vehicleId && wo.vehicle) {
      if (wo.temporaryRepair || woExt.operatingRestriction?.trim()) {
        // VehicleStatus has no RESTRICTED value — use OUT_OF_SERVICE + restriction text.
        await this.prisma.vehicle.update({
          where: { id: wo.vehicleId },
          data: { status: VehicleStatus.OUT_OF_SERVICE }
        });
        await this.auditTargetStatusChange({
          tenantId,
          workOrderId: wo.id,
          entity: "Vehicle",
          entityId: wo.vehicleId,
          before: wo.vehicle.status,
          after: VehicleStatus.OUT_OF_SERVICE,
          actor,
          reason:
            input.note?.trim() ||
            `Temporary repair / operating restriction after ${wo.woNumber} — not AVAILABLE`
        });
      } else if (complianceBlocks && input.allowComplianceBlockedMaintenanceComplete) {
        if (wo.vehicle.status === VehicleStatus.UNDER_MAINTENANCE) {
          await this.prisma.vehicle.update({
            where: { id: wo.vehicleId },
            data: { status: VehicleStatus.OUT_OF_SERVICE }
          });
          await this.auditTargetStatusChange({
            tenantId,
            workOrderId: wo.id,
            entity: "Vehicle",
            entityId: wo.vehicleId,
            before: wo.vehicle.status,
            after: VehicleStatus.OUT_OF_SERVICE,
            actor,
            reason: `Maintenance complete; compliance blocks AVAILABLE (${wo.woNumber})`
          });
        }
      } else if (
        wo.vehicle.status === VehicleStatus.UNDER_MAINTENANCE ||
        wo.vehicle.status === VehicleStatus.OUT_OF_SERVICE
      ) {
        await this.prisma.vehicle.update({
          where: { id: wo.vehicleId },
          data: { status: VehicleStatus.AVAILABLE }
        });
        await this.auditTargetStatusChange({
          tenantId,
          workOrderId: wo.id,
          entity: "Vehicle",
          entityId: wo.vehicleId,
          before: wo.vehicle.status,
          after: VehicleStatus.AVAILABLE,
          actor,
          reason: input.note?.trim() || `Return to service after ${wo.woNumber}`
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entity: "WorkOrder",
        entityId: wo.id,
        action: AuditAction.UPDATE,
        actorId: actor?.sub,
        reason: input.note?.trim() || "Return to service",
        metadata: JSON.stringify({
          event: "domain_return_to_service",
          woNumber: wo.woNumber,
          jobDomain: wo.jobDomain
        })
      }
    });

    return this.prisma.workOrder.findFirstOrThrow({
      where: { id: wo.id, tenantId },
      include: { asset: true, vehicle: true, functionalLocation: true }
    });
  }

  async getDomainContext(workOrderId: string, actor?: Actor) {
    const tenantId = this.tenantId(actor);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        asset: {
          include: {
            domain: { select: { code: true, name: true } },
            site: { select: { id: true, name: true, code: true } },
            functionalLocation: { select: { id: true, code: true, name: true } }
          }
        },
        vehicle: true,
        functionalLocation: {
          include: {
            site: { select: { id: true, name: true, code: true } },
            parent: { select: { id: true, code: true, name: true } }
          }
        },
        site: { select: { id: true, name: true, code: true } },
        accident: { select: { id: true, reportNumber: true, status: true } }
      }
    });
    if (!wo) throw new NotFoundException("Work order not found");

    const domain = parseJobDomain(wo.jobDomain);
    const targetOr: Array<Record<string, string>> = [];
    if (wo.assetId) targetOr.push({ assetId: wo.assetId });
    if (wo.vehicleId) targetOr.push({ vehicleId: wo.vehicleId });
    if (wo.functionalLocationId) targetOr.push({ functionalLocationId: wo.functionalLocationId });

    const openOnTarget =
      targetOr.length === 0
        ? 0
        : await this.prisma.workOrder.count({
            where: {
              tenantId,
              id: { not: wo.id },
              status: { in: OPEN_CRITICAL_STATUSES },
              OR: targetOr
            }
          });

    const criticalOpen = await this.countCriticalOpenWorkOrders({
      tenantId,
      vehicleId: wo.vehicleId,
      assetId: wo.assetId,
      excludeWorkOrderId: wo.id
    });

    const controlIndicators: Array<{
      code: string;
      label: string;
      severity: "INFO" | "WARNING" | "CRITICAL";
    }> = [];

    if (wo.repeatFailureCandidate) {
      controlIndicators.push({
        code: "REPEAT_FAILURE",
        label:
          domain === "VEHICLE"
            ? "Repeat Vehicle Failure / Review Required"
            : domain === "SERVICE"
              ? "Repeat Facility Issue / Review Required"
              : "Repeat Failure / Review Required",
        severity: "WARNING"
      });
    }
    if (wo.temporaryRepair) {
      controlIndicators.push({
        code: "TEMPORARY_REPAIR",
        label: "Temporary repair — follow-up required",
        severity: "WARNING"
      });
    }
    if (criticalOpen > 0) {
      controlIndicators.push({
        code: "CRITICAL_OPEN_WO",
        label: "Another critical open work order on this target",
        severity: "CRITICAL"
      });
    }

    const vehicle = wo.vehicle;
    let serviceDue: Record<string, unknown> | null = null;
    if (vehicle) {
      const lastMileage = vehicle.currentMileage != null ? Number(vehicle.currentMileage) : null;
      const interval =
        vehicle.serviceIntervalMileage != null ? Number(vehicle.serviceIntervalMileage) : null;
      const nextMileage =
        vehicle.nextServiceMileage != null
          ? Number(vehicle.nextServiceMileage)
          : lastMileage != null && interval != null && interval > 0
            ? lastMileage + interval
            : null;
      const overdueByKm =
        nextMileage != null && lastMileage != null ? Math.max(0, lastMileage - nextMileage) : 0;
      const configured = Boolean(
        vehicle.serviceIntervalMileage ||
          vehicle.serviceIntervalDays ||
          vehicle.nextServiceDate ||
          vehicle.nextServiceMileage
      );
      serviceDue = {
        serviceStatus: configured
          ? vehicle.serviceStatus || "Not configured"
          : "Not configured",
        lastServiceDate: vehicle.lastServiceDate,
        nextServiceDate: vehicle.nextServiceDate,
        nextServiceMileage: nextMileage,
        serviceIntervalMileage: interval,
        currentMileage: lastMileage,
        overdueByKm,
        configured
      };
      if (
        String(vehicle.complianceStatus ?? "")
          .toUpperCase()
          .includes("NON_COMPLIANT")
      ) {
        controlIndicators.push({
          code: "COMPLIANCE_WARNING",
          label: "Compliance warning — may block road release",
          severity: "WARNING"
        });
      }
    }

    const woExt = wo as typeof wo & {
      functionalTestResult?: string | null;
      roadTestResult?: string | null;
      completionMeterReading?: number | null;
      operatingRestriction?: string | null;
      productionImpact?: string | null;
    };

    return {
      workOrderId: wo.id,
      woNumber: wo.woNumber,
      jobDomain: domain ?? wo.jobDomain,
      identity: {
        machinery: wo.asset
          ? {
              label: formatAssetIdentity(wo.asset),
              assetCode: wo.asset.assetTag,
              name: wo.asset.name,
              category: wo.asset.category,
              criticality: wo.asset.criticality,
              operationalStatus: displayOperationalStatus(wo.asset.status),
              statusRaw: wo.asset.status,
              site: wo.asset.site
                ? formatLocationIdentity({ code: wo.asset.site.code, name: wo.asset.site.name })
                : null,
              functionalLocation: wo.asset.functionalLocation
                ? formatLocationIdentity(wo.asset.functionalLocation)
                : null,
              domainCode: wo.asset.domain?.code ?? null,
              meterReading: wo.asset.meterReading
            }
          : null,
        service: wo.functionalLocation
          ? {
              label: formatLocationIdentity(wo.functionalLocation),
              code: wo.functionalLocation.code,
              name: wo.functionalLocation.name,
              type: wo.functionalLocation.type,
              site: wo.functionalLocation.site
                ? formatLocationIdentity({
                    code: wo.functionalLocation.site.code,
                    name: wo.functionalLocation.site.name
                  })
                : wo.site
                  ? formatLocationIdentity({ code: wo.site.code, name: wo.site.name })
                  : null,
              parent: wo.functionalLocation.parent
                ? formatLocationIdentity(wo.functionalLocation.parent)
                : null
            }
          : null,
        vehicle: vehicle
          ? {
              label: formatVehicleIdentity(vehicle),
              registrationNo: vehicle.registrationNo,
              vehicleCode: vehicle.assetTag,
              make: vehicle.make,
              model: vehicle.vehicleModel,
              operationalStatus: displayOperationalStatus(vehicle.status),
              statusRaw: vehicle.status,
              currentMileage: vehicle.currentMileage,
              complianceStatus: vehicle.complianceStatus || "Status not set",
              serviceStatus: vehicle.serviceStatus || "Not configured",
              assetId: vehicle.assetId
            }
          : null
      },
      completion: {
        functionalTestResult: woExt.functionalTestResult ?? null,
        roadTestResult: woExt.roadTestResult ?? null,
        completionMeterReading: woExt.completionMeterReading ?? null,
        operatingRestriction: woExt.operatingRestriction ?? null,
        productionImpact: woExt.productionImpact ?? null,
        temporaryRepair: wo.temporaryRepair,
        temporaryRepairExpiry: wo.temporaryRepairExpiry,
        productionResumedAt: wo.productionResumedAt,
        failureCode: wo.failureCodeSnapshot,
        causeCode: wo.causeCodeSnapshot,
        remedyCode: wo.remedyCodeSnapshot,
        completionCondition: wo.completionCondition
      },
      serviceDue,
      openJobsOnTarget: openOnTarget,
      criticalOpenWorkOrders: criticalOpen,
      controlIndicators,
      accident: wo.accident
        ? {
            id: wo.accident.id,
            reportNumber: wo.accident.reportNumber,
            status: wo.accident.status
          }
        : null,
      readOnlyHints: {
        qrOptional: true,
        requesterDescriptionPreserved: true,
        vehicleStatusSeparateFromWorkOrder: true,
        blankVehicleStatusIsNotAvailable: true
      }
    };
  }

  private assertTargetNotRetired(status: string | null | undefined, label: string) {
    const normalized = String(status ?? "")
      .trim()
      .toUpperCase();
    if (normalized === "RETIRED" || normalized === "DISPOSED") {
      throw new BadRequestException(`Cannot start work on a ${normalized.toLowerCase()} ${label}.`);
    }
  }

  private async auditTargetStatusChange(input: {
    tenantId: string;
    workOrderId: string;
    entity: string;
    entityId: string;
    before: string;
    after: string;
    actor?: Actor;
    reason: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        entity: input.entity,
        entityId: input.entityId,
        action: AuditAction.UPDATE,
        actorId: input.actor?.sub,
        reason: input.reason,
        beforeData: JSON.stringify({ status: input.before }),
        afterData: JSON.stringify({ status: input.after }),
        metadata: JSON.stringify({
          event: "domain_target_status_sync",
          workOrderId: input.workOrderId,
          before: input.before,
          after: input.after
        })
      }
    });
  }
}
