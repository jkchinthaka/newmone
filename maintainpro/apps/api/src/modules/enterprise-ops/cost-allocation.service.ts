import { Injectable } from "@nestjs/common";
import { Prisma, WorkOrderStatus } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "tenantId">;

export type VehicleCostRow = {
  vehicleId: string;
  registrationNo: string;
  department: string | null;
  costCenter: string | null;
  partsCost: number;
  labourCost: number | null;
  externalRepairCost: number;
  fuelCost: number;
  fineCost: number;
  accidentCost: number;
  insuranceCost: number;
  totalMaintenanceCost: number;
  totalOperatingCost: number;
  distanceKm: number | null;
  costPerKm: number | null;
  coverage: "COMPLETE" | "INSUFFICIENT_DATA";
};

@Injectable()
export class CostAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  async summarizeFleet(actor: Actor, range?: { start?: Date; end?: Date }): Promise<VehicleCostRow[]> {
    const tenantId = requireTenantId(actor.tenantId);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId },
      select: {
        id: true,
        registrationNo: true,
        costCenter: true,
        currentMileage: true,
        department: { select: { name: true } }
      },
      take: 300
    });
    const rows: VehicleCostRow[] = [];
    for (const vehicle of vehicles) {
      rows.push(await this.summarizeVehicle(tenantId, vehicle, range));
    }
    return rows.sort((a, b) => b.totalOperatingCost - a.totalOperatingCost);
  }

  async summarizeVehicle(
    tenantId: string,
    vehicle: { id: string; registrationNo: string; costCenter: string | null; currentMileage: number; department?: { name: string } | null },
    range?: { start?: Date; end?: Date }
  ): Promise<VehicleCostRow> {
    const dateFilter = range?.start || range?.end
      ? { gte: range.start, lte: range.end }
      : undefined;

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        vehicleId: vehicle.id,
        status: WorkOrderStatus.COMPLETED,
        ...(dateFilter ? { completedDate: dateFilter } : {})
      },
      select: { id: true, actualCost: true, actualHours: true, parts: { select: { totalCost: true } } }
    });
    const [fuel, fines, accidents, claims, vendorInvoices, trips] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where: { vehicleId: vehicle.id, vehicle: { tenantId }, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { totalCost: true }
      }),
      this.prisma.trafficFine.findMany({
        where: { tenantId, vehicleId: vehicle.id, ...(dateFilter ? { fineDate: dateFilter } : {}) },
        select: { fineAmount: true, paidAmount: true }
      }),
      this.prisma.accidentReport.findMany({
        where: { tenantId, vehicleId: vehicle.id, ...(dateFilter ? { occurredAt: dateFilter } : {}) },
        select: { actualDamageCost: true, estimatedDamageCost: true }
      }),
      this.prisma.insuranceClaim.findMany({
        where: { tenantId, vehicleId: vehicle.id },
        select: { claimAmount: true, approvedAmount: true }
      }),
      workOrders.length === 0
        ? Promise.resolve([])
        : this.prisma.vendorInvoice.findMany({
            where: { tenantId, workOrderId: { in: workOrders.map((row) => row.id) } },
            select: { totalAmount: true }
          }),
      this.prisma.tripLog.findMany({
        where: { vehicleId: vehicle.id, vehicle: { tenantId }, ...(dateFilter ? { startTime: dateFilter } : {}) },
        select: { distance: true }
      })
    ]);

    const partsCost = workOrders.reduce(
      (sum, wo) => sum + wo.parts.reduce((lineSum, line) => lineSum + Number(line.totalCost ?? 0), 0),
      0
    );
    const labourKnown = workOrders.every((wo) => wo.actualHours != null && wo.actualCost != null);
    const labourCost = labourKnown
      ? workOrders.reduce((sum, wo) => sum + Math.max(0, Number(wo.actualCost ?? 0) - wo.parts.reduce((lineSum, line) => lineSum + Number(line.totalCost ?? 0), 0)), 0)
      : null;
    const externalRepairCost = vendorInvoices.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
    const fuelCost = fuel.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0);
    const fineCost = fines.reduce((sum, row) => sum + Number(row.paidAmount ?? row.fineAmount ?? 0), 0);
    const accidentCost = accidents.reduce(
      (sum, row) => sum + Number(row.actualDamageCost ?? row.estimatedDamageCost ?? 0),
      0
    );
    const insuranceCost = claims.reduce((sum, row) => sum + Number(row.approvedAmount ?? row.claimAmount ?? 0), 0);
    const totalMaintenanceCost = partsCost + (labourCost ?? 0) + externalRepairCost;
    const totalOperatingCost = totalMaintenanceCost + fuelCost + fineCost + accidentCost + insuranceCost;
    const distanceKm = trips.reduce((sum, trip) => sum + Number(trip.distance ?? 0), 0);
    const hasDistance = distanceKm > 0;
    return {
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      department: vehicle.department?.name ?? null,
      costCenter: vehicle.costCenter,
      partsCost,
      labourCost,
      externalRepairCost,
      fuelCost,
      fineCost,
      accidentCost,
      insuranceCost,
      totalMaintenanceCost,
      totalOperatingCost,
      distanceKm: hasDistance ? distanceKm : null,
      costPerKm: hasDistance ? totalOperatingCost / distanceKm : null,
      coverage: hasDistance ? "COMPLETE" : "INSUFFICIENT_DATA"
    };
  }
}
