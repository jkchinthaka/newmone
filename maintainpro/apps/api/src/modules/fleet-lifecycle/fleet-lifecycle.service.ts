import { Injectable, NotFoundException } from "@nestjs/common";
import { GateMovementStatus, WorkOrderType } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  authorizeGateOverride,
  evaluateGateOut,
  fuelEfficiency,
  validateAccidentRepairClaimChain
} from "./fleet-policies";

type Actor = Pick<JwtPayload, "sub" | "tenantId"> & { role?: string };

@Injectable()
export class FleetLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async linkVehicleToAsset(actor: Actor, vehicleId: string, assetId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const [vehicle, asset] = await Promise.all([
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } }),
      this.prisma.asset.findFirst({ where: { id: assetId, tenantId } })
    ]);
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (!asset) throw new NotFoundException("Asset not found");
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { assetId, assetTag: asset.assetTag }
    });
  }

  async upsertTyre(
    actor: Actor,
    input: {
      id?: string;
      vehicleId: string;
      serialNumber?: string;
      brand?: string;
      size?: string;
      wheelPosition?: string;
      installedAt?: Date;
      installedMileage?: number;
      condition?: string;
      cost?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (input.id) {
      return this.prisma.vehicleTyre.update({
        where: { id: input.id },
        data: {
          serialNumber: input.serialNumber,
          brand: input.brand,
          size: input.size,
          wheelPosition: input.wheelPosition,
          installedAt: input.installedAt,
          installedMileage: input.installedMileage,
          condition: input.condition as any,
          cost: input.cost,
          notes: input.notes
        }
      });
    }
    return this.prisma.vehicleTyre.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        serialNumber: input.serialNumber,
        brand: input.brand,
        size: input.size,
        wheelPosition: input.wheelPosition,
        installedAt: input.installedAt,
        installedMileage: input.installedMileage,
        condition: (input.condition as any) ?? "GOOD",
        cost: input.cost,
        notes: input.notes
      }
    });
  }

  async upsertBattery(
    actor: Actor,
    input: {
      id?: string;
      vehicleId: string;
      serialNumber?: string;
      brand?: string;
      capacityAh?: number;
      installedAt?: Date;
      warrantyExpiresAt?: Date;
      failureReason?: string;
      cost?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (input.id) {
      return this.prisma.vehicleBattery.update({
        where: { id: input.id },
        data: { ...input, id: undefined, vehicleId: undefined } as any
      });
    }
    return this.prisma.vehicleBattery.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        serialNumber: input.serialNumber,
        brand: input.brand,
        capacityAh: input.capacityAh,
        installedAt: input.installedAt,
        warrantyExpiresAt: input.warrantyExpiresAt,
        failureReason: input.failureReason,
        cost: input.cost,
        notes: input.notes
      }
    });
  }

  async evaluateAndRecordGateOut(
    actor: Actor,
    input: {
      vehicleId: string;
      driverId?: string;
      override?: boolean;
      overrideReason?: string;
      approved?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId },
      include: {
        driver: true,
        documents: true
      }
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");

    const now = new Date();
    const insuranceValid =
      !vehicle.insuranceExpiry || vehicle.insuranceExpiry.getTime() >= now.getTime();
    const revenueLicenceValid =
      !vehicle.roadTaxExpiry || vehicle.roadTaxExpiry.getTime() >= now.getTime();
    const driver = input.driverId
      ? await this.prisma.driver.findFirst({ where: { id: input.driverId, tenantId } })
      : vehicle.driver;
    const licenceValid =
      !driver?.licenseExpiry || driver.licenseExpiry.getTime() >= now.getTime();

    const decision = evaluateGateOut({
      vehicleActive: vehicle.status === "AVAILABLE" || vehicle.status === "IN_USE",
      driverActive: driver ? driver.isAvailable !== false : false,
      driverLicenceValid: Boolean(driver) && licenceValid,
      insuranceValid,
      revenueLicenceValid,
      criticalServiceOverdue: Boolean(
        vehicle.nextServiceDate && vehicle.nextServiceDate.getTime() < now.getTime()
      ),
      criticalInspectionDefect: false,
      blockFlag: Boolean((vehicle as any).blockFlag)
    });

    let status: GateMovementStatus = decision.allowed
      ? GateMovementStatus.ALLOWED
      : GateMovementStatus.BLOCKED;
    let overrideReason: string | undefined;
    let approvedById: string | undefined;

    if (!decision.allowed && input.override) {
      const auth = authorizeGateOverride({
        hasPermission: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SECURITY_OFFICER"].includes(
          String(actor.role ?? "")
        ),
        reason: input.overrideReason,
        approvalRequired: false,
        approved: input.approved
      });
      if (auth.allowed) {
        status = GateMovementStatus.OVERRIDE_APPROVED;
        overrideReason = input.overrideReason;
        approvedById = actor.sub;
      }
    }

    const movement = await this.prisma.vehicleGateMovement.create({
      data: {
        vehicleId: vehicle.id,
        driverId: driver?.id,
        movementType: "OUT",
        status,
        meterReading: vehicle.currentMileage ?? 0,
        blockedReason: decision.blockedReasons.join(",") || undefined,
        overrideReason,
        approvedById,
        occurredAt: now
      }
    });

    return { decision, movement, status };
  }

  computeFuelReport(input: { litres: number; distanceKm: number; amount: number }) {
    return fuelEfficiency(input);
  }

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
          title: `Accident repair ${accident.id}`,
          description: "Repair WO from accident",
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
      await this.prisma.insuranceClaim.update({
        where: { id: input.insuranceClaimId },
        data: { accidentId: accident.id, vehicleId: accident.vehicleId } as any
      });
    }

    const chain = validateAccidentRepairClaimChain({
      accidentId: accident.id,
      repairWorkOrderId,
      insuranceClaimId: input.insuranceClaimId
    });
    return { ...chain, repairWorkOrderId, insuranceClaimId: input.insuranceClaimId };
  }
}
