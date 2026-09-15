/**
 * FleetLifecycleService — Phase 10 fleet lifecycle management.
 *
 * Vehicle = Asset extension (Vehicle.assetId links to Asset register).
 * Mileage is tracked via AssetMeter type MILEAGE, mirroring Phase 8 meter engine.
 * Gate eligibility is read-only here; vehicles.service.gateOut remains the write path.
 * Gate overrides use the Phase 7 Approval Engine (GATE_OVERRIDE process type).
 * Accident repairs are linked via Phase 6 Work Orders (ACCIDENT_REPAIR type).
 * Compliance/docs use Phase 8 ComplianceRequirement model.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import {
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalTrigger,
  TyreCondition,
  WorkOrderType
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ApprovalsService } from "../approvals/approvals.service";
import {
  authorizeGateOverride,
  costPerKm as computeCostPerKmPure,
  evaluateGateOut,
  fuelEfficiency,
  hasActiveTyreConflict,
  validateAccidentRepairClaimChain
} from "./fleet-policies";

type Actor = Pick<JwtPayload, "sub" | "tenantId"> & { role?: string };

const GATE_OVERRIDE_APPROVER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "FLEET_MANAGER",
  "SECURITY_OFFICER"
]);

@Injectable()
export class FleetLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    // ApprovalsService is optional — gate override uses it when configured
    @Optional() private readonly approvalsService?: ApprovalsService
  ) {}

  // ── Vehicle ↔ Asset backfill ──────────────────────────────────────────────

  /**
   * Lists vehicles without an assetId.
   * If dryRun=false (apply mode), creates an Asset (category VEHICLE) for each
   * and links via Vehicle.assetId — tenant-aware, idempotent.
   * Duplicate registrationNo within the same tenant is reported but not silently mapped.
   */
  async previewVehicleAssetBackfill(
    actor: Actor,
    opts: { dryRun?: boolean } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const dryRun = opts.dryRun !== false; // default true

    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId, assetId: null },
      select: {
        id: true,
        registrationNo: true,
        make: true,
        vehicleModel: true,
        tenantId: true
      }
    });

    const regCounts = new Map<string, number>();
    for (const v of vehicles) {
      regCounts.set(v.registrationNo, (regCounts.get(v.registrationNo) ?? 0) + 1);
    }

    const report: Array<{
      vehicleId: string;
      registrationNo: string;
      duplicate: boolean;
      action: "would_create" | "created" | "skipped_duplicate";
      assetId?: string;
    }> = [];

    for (const v of vehicles) {
      const isDuplicate = (regCounts.get(v.registrationNo) ?? 0) > 1;
      if (isDuplicate) {
        report.push({
          vehicleId: v.id,
          registrationNo: v.registrationNo,
          duplicate: true,
          action: "skipped_duplicate"
        });
        continue;
      }

      if (dryRun) {
        report.push({
          vehicleId: v.id,
          registrationNo: v.registrationNo,
          duplicate: false,
          action: "would_create"
        });
        continue;
      }

      // Apply: create Asset and link
      const asset = await this.prisma.asset.create({
        data: {
          tenantId: tenantId as string,
          name: `${v.make} ${v.vehicleModel} (${v.registrationNo})`,
          category: "VEHICLE",
          status: "ACTIVE"
        } as any
      });

      await this.prisma.vehicle.update({
        where: { id: v.id },
        data: { assetId: asset.id }
      });

      report.push({
        vehicleId: v.id,
        registrationNo: v.registrationNo,
        duplicate: false,
        action: "created",
        assetId: asset.id
      });
    }

    return {
      mode: dryRun ? "dry-run" : "apply",
      totalWithoutAsset: vehicles.length,
      report
    };
  }

  /**
   * Ensures an AssetMeter of type MILEAGE exists for the vehicle's linked Asset.
   * Upserts by tenant+asset+type; syncs currentValue from vehicle.currentMileage.
   * No-op if vehicle has no assetId.
   */
  async ensureMileageMeter(actor: Actor, vehicleId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (!vehicle.assetId) {
      return { skipped: true, reason: "Vehicle has no linked Asset" };
    }

    const existing = await this.prisma.assetMeter.findFirst({
      where: { tenantId, assetId: vehicle.assetId, meterType: "MILEAGE" }
    });

    if (existing) {
      // Sync the reading from current mileage
      await this.prisma.assetMeter.update({
        where: { id: existing.id },
        data: {
          currentValue: vehicle.currentMileage,
          lastReadingAt: new Date()
        }
      });
      return { created: false, updated: true, meterId: existing.id };
    }

    const meter = await this.prisma.assetMeter.create({
      data: {
        tenantId,
        assetId: vehicle.assetId,
        vehicleId: vehicle.id,
        meterType: "MILEAGE",
        name: "Odometer (km)",
        unit: "km",
        currentValue: vehicle.currentMileage,
        lastReadingAt: new Date(),
        isActive: true
      } as any
    });

    return { created: true, updated: false, meterId: meter.id };
  }

  // ── Tyre lifecycle ────────────────────────────────────────────────────────

  async installTyre(
    actor: Actor,
    input: {
      vehicleId: string;
      serialNumber?: string;
      brand?: string;
      size?: string;
      tyreType?: string;
      wheelPosition?: string;
      installedAt?: Date;
      installedMileage?: number;
      condition?: TyreCondition;
      costSnapshot?: number;
      warrantyExpiresAt?: Date;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    // Block if another active tyre already occupies the same wheel position
    if (input.wheelPosition) {
      const active = await this.prisma.vehicleTyre.findMany({
        where: { vehicleId: input.vehicleId, isActive: true }
      });
      if (hasActiveTyreConflict(active, input.wheelPosition)) {
        throw new BadRequestException(
          `Wheel position ${input.wheelPosition} already has an active tyre. Remove or move it first.`
        );
      }
    }

    return this.prisma.vehicleTyre.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        serialNumber: input.serialNumber,
        brand: input.brand,
        size: input.size,
        tyreType: input.tyreType,
        wheelPosition: input.wheelPosition,
        installedAt: input.installedAt ?? new Date(),
        installedMileage: input.installedMileage,
        condition: input.condition ?? TyreCondition.GOOD,
        isActive: true,
        costSnapshot: input.costSnapshot,
        warrantyExpiresAt: input.warrantyExpiresAt,
        notes: input.notes
      }
    });
  }

  /**
   * Move/rotate tyre to a new wheel position.
   * Deactivates the existing row (sets removedAt + removedMileage),
   * then creates a new row at the new position preserving serial/brand/size.
   */
  async moveTyre(
    actor: Actor,
    tyreId: string,
    input: {
      newWheelPosition: string;
      removedMileage?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const tyre = await this.prisma.vehicleTyre.findFirst({
      where: { id: tyreId, tenantId, isActive: true }
    });
    if (!tyre) throw new NotFoundException("Active tyre not found");

    // Check new position is free
    const active = await this.prisma.vehicleTyre.findMany({
      where: { vehicleId: tyre.vehicleId, isActive: true, id: { not: tyreId } }
    });
    if (hasActiveTyreConflict(active, input.newWheelPosition)) {
      throw new BadRequestException(
        `Wheel position ${input.newWheelPosition} already has an active tyre.`
      );
    }

    const now = new Date();
    await this.prisma.vehicleTyre.update({
      where: { id: tyreId },
      data: { isActive: false, removedAt: now, removedMileage: input.removedMileage }
    });

    return this.prisma.vehicleTyre.create({
      data: {
        tenantId,
        vehicleId: tyre.vehicleId,
        serialNumber: tyre.serialNumber,
        brand: tyre.brand,
        size: tyre.size,
        tyreType: tyre.tyreType,
        wheelPosition: input.newWheelPosition,
        installedAt: now,
        installedMileage: input.removedMileage,
        rotatedAt: now,
        retreadCount: tyre.retreadCount,
        condition: tyre.condition,
        isActive: true,
        costSnapshot: tyre.costSnapshot,
        warrantyExpiresAt: tyre.warrantyExpiresAt,
        notes: input.notes ?? tyre.notes
      }
    });
  }

  async removeTyre(actor: Actor, tyreId: string, input: { removedMileage?: number; notes?: string }) {
    const tenantId = requireTenantId(actor.tenantId);
    const tyre = await this.prisma.vehicleTyre.findFirst({
      where: { id: tyreId, tenantId }
    });
    if (!tyre) throw new NotFoundException("Tyre not found");
    return this.prisma.vehicleTyre.update({
      where: { id: tyreId },
      data: {
        isActive: false,
        removedAt: new Date(),
        removedMileage: input.removedMileage,
        notes: input.notes ?? tyre.notes
      }
    });
  }

  // ── Battery lifecycle ─────────────────────────────────────────────────────

  /**
   * Install battery — if another active battery exists on the same vehicle,
   * deactivate it first (preserving history), then create the new one.
   */
  async installBattery(
    actor: Actor,
    input: {
      vehicleId: string;
      serialNumber?: string;
      brand?: string;
      model?: string;
      capacityAh?: number;
      installedAt?: Date;
      warrantyExpiresAt?: Date;
      condition?: string;
      costSnapshot?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    // Deactivate existing active battery if present
    const existing = await this.prisma.vehicleBattery.findFirst({
      where: { vehicleId: input.vehicleId, isActive: true }
    });
    if (existing) {
      await this.prisma.vehicleBattery.update({
        where: { id: existing.id },
        data: { isActive: false, removedAt: new Date() }
      });
    }

    return this.prisma.vehicleBattery.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        serialNumber: input.serialNumber,
        brand: input.brand,
        model: input.model,
        capacityAh: input.capacityAh,
        installedAt: input.installedAt ?? new Date(),
        warrantyExpiresAt: input.warrantyExpiresAt,
        condition: input.condition,
        costSnapshot: input.costSnapshot,
        isActive: true,
        notes: input.notes
      }
    });
  }

  async replaceBattery(
    actor: Actor,
    batteryId: string,
    input: {
      vehicleId?: string;
      serialNumber?: string;
      brand?: string;
      model?: string;
      capacityAh?: number;
      warrantyExpiresAt?: Date;
      failureReason?: string;
      costSnapshot?: number;
      replacementWorkOrderId?: string;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const battery = await this.prisma.vehicleBattery.findFirst({
      where: { id: batteryId, tenantId }
    });
    if (!battery) throw new NotFoundException("Battery not found");

    // Deactivate the old battery with failure reason
    await this.prisma.vehicleBattery.update({
      where: { id: batteryId },
      data: {
        isActive: false,
        removedAt: new Date(),
        failureReason: input.failureReason
      }
    });

    // Install the replacement
    return this.prisma.vehicleBattery.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId ?? battery.vehicleId,
        serialNumber: input.serialNumber,
        brand: input.brand,
        model: input.model,
        capacityAh: input.capacityAh,
        installedAt: new Date(),
        warrantyExpiresAt: input.warrantyExpiresAt,
        isActive: true,
        costSnapshot: input.costSnapshot,
        replacementWorkOrderId: input.replacementWorkOrderId,
        notes: input.notes
      }
    });
  }

  // ── Gate eligibility (read-only decision) ─────────────────────────────────

  /**
   * Evaluate gate eligibility for a vehicle (read-only).
   * NOTE: This does NOT write gate movements — vehicles.service.gateOut is the
   * authoritative write path. This method provides a read-only decision for UX
   * or pre-checks. Use gate.check permission.
   */
  async evaluateGateEligibility(
    actor: Actor,
    vehicleId: string,
    driverId?: string
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const now = new Date();

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      include: { driver: true }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const driver = driverId
      ? await this.prisma.driver.findFirst({ where: { id: driverId, tenantId } })
      : vehicle.driver;

    const insuranceValid =
      !vehicle.insuranceExpiry || vehicle.insuranceExpiry.getTime() >= now.getTime();
    const roadTaxValid =
      !vehicle.roadTaxExpiry || vehicle.roadTaxExpiry.getTime() >= now.getTime();
    const licenceValid = driver
      ? !driver.licenseExpiry || driver.licenseExpiry.getTime() >= now.getTime()
      : false;

    const criticalServiceOverdue = Boolean(
      vehicle.nextServiceDate && vehicle.nextServiceDate.getTime() < now.getTime()
    );

    // Warn if expiring within 30 days
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const insuranceExpiringSoon =
      insuranceValid &&
      Boolean(
        vehicle.insuranceExpiry &&
          vehicle.insuranceExpiry.getTime() - now.getTime() < thirtyDaysMs
      );
    const docExpiringSoon =
      roadTaxValid &&
      Boolean(
        vehicle.roadTaxExpiry &&
          vehicle.roadTaxExpiry.getTime() - now.getTime() < thirtyDaysMs
      );
    const pmDueSoon =
      !criticalServiceOverdue &&
      Boolean(
        vehicle.nextServiceDate &&
          vehicle.nextServiceDate.getTime() - now.getTime() < thirtyDaysMs
      );

    const decision = evaluateGateOut({
      vehicleActive:
        vehicle.status === "AVAILABLE" || vehicle.status === "IN_USE",
      driverActive: driver ? driver.isAvailable !== false : false,
      driverLicenceValid: Boolean(driver) && licenceValid,
      insuranceValid,
      revenueLicenceValid: roadTaxValid,
      criticalServiceOverdue,
      criticalInspectionDefect: false,
      blockFlag: Boolean(vehicle.gateBlocked),
      pmDueSoon,
      docExpiringSoon,
      insuranceExpiringSoon
    });

    return {
      ...decision,
      evaluatedAt: now,
      evaluatedRules: [
        "VEHICLE_STATUS",
        "DRIVER_STATUS",
        "DRIVER_LICENCE",
        "INSURANCE",
        "REVENUE_LICENCE",
        "CRITICAL_SERVICE",
        "GATE_BLOCK_FLAG"
      ],
      vehicleId,
      driverId: driver?.id
    };
  }

  // ── Driver assignment ─────────────────────────────────────────────────────

  async assignDriver(
    actor: Actor,
    vehicleId: string,
    driverId: string,
    opts: { openingMileage?: number; notes?: string } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const [vehicle, driver] = await Promise.all([
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } }),
      this.prisma.driver.findFirst({ where: { id: driverId, tenantId } })
    ]);
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (!driver) throw new NotFoundException("Driver not found");

    // Close any current open assignment
    await this.prisma.vehicleAssignment.updateMany({
      where: { vehicleId, isCurrent: true },
      data: { isCurrent: false, returnedAt: new Date() }
    });

    const assignment = await this.prisma.vehicleAssignment.create({
      data: {
        tenantId,
        vehicleId,
        driverId,
        assignedAt: new Date(),
        openingMileage: opts.openingMileage,
        notes: opts.notes,
        assignedById: actor.sub,
        isCurrent: true
      }
    });

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { driverId }
    });

    return assignment;
  }

  async returnAssignment(
    actor: Actor,
    assignmentId: string,
    opts: { closingMileage?: number; notes?: string } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const assignment = await this.prisma.vehicleAssignment.findFirst({
      where: { id: assignmentId, tenantId }
    });
    if (!assignment) throw new NotFoundException("Assignment not found");

    return this.prisma.vehicleAssignment.update({
      where: { id: assignmentId },
      data: {
        isCurrent: false,
        returnedAt: new Date(),
        closingMileage: opts.closingMileage,
        notes: opts.notes ?? assignment.notes,
        returnedById: actor.sub
      }
    });
  }

  // ── Fuel & cost analytics ─────────────────────────────────────────────────

  computeFuelReport(input: { litres: number; distanceKm: number; amount: number }) {
    return fuelEfficiency(input);
  }

  computeCostPerKm(input: { maintenanceCost: number; distanceKm: number }) {
    return computeCostPerKmPure(input);
  }

  // ── Accident → WO → Claim chain ───────────────────────────────────────────

  /**
   * Link an accident to a repair WorkOrder and optionally an insurance claim.
   * If no repairWorkOrderId is supplied, creates one with type ACCIDENT_REPAIR.
   * Validates the chain using fleet-policies.validateAccidentRepairClaimChain.
   */
  async linkAccidentRepairClaim(
    actor: Actor,
    input: {
      accidentId: string;
      repairWorkOrderId?: string;
      insuranceClaimId?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const accident = await this.prisma.accidentReport.findFirst({
      where: { id: input.accidentId, tenantId }
    });
    if (!accident) throw new NotFoundException("Accident not found");

    let repairWorkOrderId = input.repairWorkOrderId;
    if (!repairWorkOrderId) {
      const wo = await this.prisma.workOrder.create({
        data: {
          tenantId,
          woNumber: `ACC-${Date.now().toString(36).toUpperCase()}`,
          title: `Accident repair – ${accident.id.slice(-6)}`,
          description: "Repair work order created from accident report",
          type: WorkOrderType.ACCIDENT_REPAIR,
          vehicleId: accident.vehicleId,
          accidentId: accident.id,
          createdById: actor.sub
        }
      });
      repairWorkOrderId = wo.id;
    } else {
      await this.prisma.workOrder.update({
        where: { id: repairWorkOrderId },
        data: { accidentId: accident.id, type: WorkOrderType.ACCIDENT_REPAIR }
      });
    }

    if (input.insuranceClaimId) {
      await this.prisma.insuranceClaim
        .update({
          where: { id: input.insuranceClaimId },
          data: { accidentId: accident.id } as any
        })
        .catch(() => {
          // Best-effort link — claim may not have accidentId field in all schema versions
        });
    }

    const chain = validateAccidentRepairClaimChain({
      accidentId: accident.id,
      repairWorkOrderId,
      insuranceClaimId: input.insuranceClaimId
    });

    return { ...chain, repairWorkOrderId, insuranceClaimId: input.insuranceClaimId };
  }

  // ── Fleet home summary ────────────────────────────────────────────────────

  /**
   * Overview counts for the fleet home page.
   * All counts are tenant-scoped.
   */
  async fleetHomeSummary(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      dueService,
      overdueService,
      expiringDocs,
      blockedVehicles,
      openRepairs,
      outOfService,
      activeTyreIssues,
      batteriesWarrantyExpiring
    ] = await Promise.all([
      this.prisma.vehicle.count({
        where: {
          tenantId,
          nextServiceDate: { gte: now, lte: in30Days }
        }
      }),
      this.prisma.vehicle.count({
        where: { tenantId, nextServiceDate: { lt: now } }
      }),
      this.prisma.vehicle.count({
        where: {
          tenantId,
          OR: [
            { insuranceExpiry: { gte: now, lte: in30Days } },
            { roadTaxExpiry: { gte: now, lte: in30Days } }
          ]
        }
      }),
      this.prisma.vehicle.count({ where: { tenantId, gateBlocked: true } }),
      this.prisma.workOrder.count({
        where: {
          tenantId,
          type: WorkOrderType.ACCIDENT_REPAIR,
          status: { notIn: ["CLOSED", "CANCELLED"] as any }
        }
      }),
      this.prisma.vehicle.count({ where: { tenantId, status: "OUT_OF_SERVICE" as any } }),
      this.prisma.vehicleTyre.count({
        where: {
          tenantId,
          isActive: true,
          condition: { in: [TyreCondition.POOR, TyreCondition.DISPOSED] }
        }
      }),
      this.prisma.vehicleBattery.count({
        where: {
          tenantId,
          isActive: true,
          warrantyExpiresAt: { gte: now, lte: in30Days }
        }
      })
    ]);

    return {
      dueService,
      overdueService,
      expiringDocs,
      blockedVehicles,
      openRepairs,
      outOfService,
      activeTyreIssues,
      batteriesWarrantyExpiring,
      asOf: now
    };
  }

  // ── Gate override with Approval Engine ───────────────────────────────────

  /**
   * Evaluate whether a gate override requires a formal approval.
   * Gate override uses the Phase 7 Approval Engine (GATE_OVERRIDE process type).
   * If approval is required and PENDING, returns { required: true, approvalRequestId }.
   * Callers (vehicles.service.gateOut) check this before allowing override.
   */
  async checkGateOverrideApproval(
    actor: Actor,
    vehicleId: string,
    blockedReasons: string[]
  ) {
    if (!this.approvalsService) {
      return { approvalRequired: false };
    }

    const result = await this.approvalsService.ensureApprovalRequired({
      actor,
      processType: ApprovalProcessType.GATE_OVERRIDE,
      trigger: ApprovalTrigger.BEFORE_GATE_OVERRIDE,
      subjectEntityType: "Vehicle",
      subjectEntityId: vehicleId,
      context: {
        processType: ApprovalProcessType.GATE_OVERRIDE,
        blockedReasons
      } as any
    });

    if (result.configError) {
      return { approvalRequired: false };
    }

    if (
      result.required &&
      (result.status === ApprovalRequestStatus.PENDING ||
        result.status === ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW)
    ) {
      return {
        approvalRequired: true,
        approvalRequestId: result.approvalRequestId,
        status: result.status
      };
    }

    return { approvalRequired: false, approvalRequestId: result.approvalRequestId };
  }
}
