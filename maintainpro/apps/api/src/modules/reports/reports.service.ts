import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [assetsByStatus, fleetByStatus, openByPriority, lowStockCount, upcomingMaintenance, maintenanceCost] = await Promise.all([
      this.prisma.asset.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.workOrder.groupBy({ by: ["priority"], where: { status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } }, _count: { _all: true } }),
      this.prisma.sparePart.count({ where: { quantityInStock: { lte: 5 } } }),
      this.prisma.maintenanceSchedule.findMany({ where: { nextDueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, take: 20, orderBy: { nextDueDate: "asc" } }),
      this.prisma.maintenanceLog.aggregate({ _sum: { cost: true } })
    ]);

    return {
      assetsByStatus,
      fleetByStatus,
      openWorkOrdersByPriority: openByPriority,
      monthlyMaintenanceCost: Number(maintenanceCost._sum.cost ?? 0),
      lowStockItemsCount: lowStockCount,
      upcomingMaintenance
    };
  }

  async maintenanceCost() {
    const logs = await this.prisma.maintenanceLog.findMany({ orderBy: { performedAt: "asc" }, include: { asset: true, vehicle: true } });

    return {
      totalCostByMonth: logs.map((log) => ({
        month: log.performedAt.toISOString().slice(0, 7),
        cost: Number(log.cost ?? 0)
      })),
      breakdownByAssetVehicle: logs.map((log) => ({
        maintenanceLogId: log.id,
        assetId: log.assetId,
        vehicleId: log.vehicleId,
        cost: Number(log.cost ?? 0)
      }))
    };
  }

  async fleetEfficiency() {
    const vehicles = await this.prisma.vehicle.findMany({ include: { fuelLogs: true, tripLogs: true } });

    return vehicles.map((vehicle) => {
      const totalDistance = vehicle.tripLogs.reduce((sum, trip) => sum + Number(trip.distance), 0);
      const totalFuel = vehicle.fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0);
      const totalCost = vehicle.fuelLogs.reduce((sum, log) => sum + Number(log.totalCost), 0);
      const averageFuelConsumption = totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;

      return {
        vehicleId: vehicle.id,
        registrationNo: vehicle.registrationNo,
        totalDistance,
        averageFuelConsumption,
        costPerKm: totalDistance > 0 ? totalCost / totalDistance : 0,
        utilizationRate: vehicle.status === "IN_USE" ? 1 : 0
      };
    });
  }

  async downtime() {
    const orders = await this.prisma.workOrder.findMany({
      where: {
        completedDate: {
          not: null
        },
        startDate: {
          not: null
        }
      }
    });

    const records = orders.map((item) => {
      const start = item.startDate?.getTime() ?? 0;
      const end = item.completedDate?.getTime() ?? 0;
      const hours = Math.max(0, end - start) / (1000 * 60 * 60);

      return {
        workOrderId: item.id,
        assetId: item.assetId,
        vehicleId: item.vehicleId,
        downtimeHours: hours
      };
    });

    return {
      records,
      mttrHours: records.length ? records.reduce((sum, item) => sum + item.downtimeHours, 0) / records.length : 0,
      mtbfHours: records.length ? 720 / records.length : 0
    };
  }

  async workOrders() {
    const [total, completed, breached, byTechnician] = await Promise.all([
      this.prisma.workOrder.count(),
      this.prisma.workOrder.count({ where: { status: "COMPLETED" } }),
      this.prisma.workOrder.count({ where: { slaBreached: true } }),
      this.prisma.workOrder.groupBy({ by: ["technicianId"], _count: { _all: true } })
    ]);

    return {
      completionRate: total > 0 ? completed / total : 0,
      slaComplianceRate: total > 0 ? (total - breached) / total : 0,
      workOrdersByTechnician: byTechnician
    };
  }

  async inventory() {
    const parts = await this.prisma.sparePart.findMany();

    return {
      stockValueByCategory: parts.map((part) => ({
        category: part.category,
        value: Number(part.unitCost) * part.quantityInStock
      })),
      reorderRequirements: parts.filter((part) => part.quantityInStock <= part.reorderPoint)
    };
  }

  async utilities() {
    const bills = await this.prisma.utilityBill.findMany({ include: { meter: true } });

    return bills.map((bill) => ({
      utilityType: bill.meter.type,
      month: bill.billingPeriodStart.toISOString().slice(0, 7),
      consumption: Number(bill.totalConsumption),
      cost: Number(bill.totalAmount),
      location: bill.meter.location
    }));
  }
}
