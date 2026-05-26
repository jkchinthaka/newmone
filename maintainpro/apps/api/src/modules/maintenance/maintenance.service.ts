import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RiskLevel } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

interface MaintenanceLogQuery {
  vehicleId?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_LOG_PAGE_SIZE = 10;
const MAX_LOG_PAGE_SIZE = 100;

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
  }

  private buildScheduleTenantWhere(tenantId: string | null | undefined): Prisma.MaintenanceScheduleWhereInput {
    if (tenantId === undefined) {
      return {};
    }

    return {
      OR: [{ asset: { tenantId } }, { vehicle: { tenantId } }]
    };
  }

  private buildLogTenantWhere(tenantId: string | null | undefined): Prisma.MaintenanceLogWhereInput {
    if (tenantId === undefined) {
      return {};
    }

    return {
      OR: [{ workOrder: { tenantId } }, { asset: { tenantId } }, { vehicle: { tenantId } }]
    };
  }

  schedules(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.buildScheduleTenantWhere(tenantId)
      },
      include: {
        maintenanceLogs: true,
        workOrders: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async schedule(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    const schedule = await this.prisma.maintenanceSchedule.findFirst({
      where: {
        id,
        ...this.buildScheduleTenantWhere(tenantId)
      },
      include: {
        maintenanceLogs: true,
        workOrders: true
      }
    });

    if (!schedule) {
      throw new NotFoundException("Maintenance schedule not found");
    }

    return schedule;
  }

  async createSchedule(data: {
    name: string;
    description?: string;
    type: "PREVENTIVE" | "PREDICTIVE" | "CORRECTIVE" | "INSPECTION";
    frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL" | "MILEAGE_BASED" | "CUSTOM";
    intervalDays?: number;
    intervalMileage?: number;
    assetId?: string;
    vehicleId?: string;
    nextDueDate?: string;
    nextDueMileage?: number;
    estimatedCost?: number;
    estimatedHours?: number;
  }, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    if (tenantId !== undefined) {
      if (!data.assetId && !data.vehicleId) {
        throw new NotFoundException("Tenant-scoped schedules must reference an asset or vehicle");
      }

      if (data.assetId) {
        const asset = await this.prisma.asset.findFirst({ where: { id: data.assetId, tenantId } });
        if (!asset) {
          throw new NotFoundException("Asset not found in tenant context");
        }
      }

      if (data.vehicleId) {
        const vehicle = await this.prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
        if (!vehicle) {
          throw new NotFoundException("Vehicle not found in tenant context");
        }
      }
    }

    return this.prisma.maintenanceSchedule.create({
      data: {
        ...data,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined
      }
    });
  }

  async updateSchedule(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type: "PREVENTIVE" | "PREDICTIVE" | "CORRECTIVE" | "INSPECTION";
      frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL" | "MILEAGE_BASED" | "CUSTOM";
      intervalDays: number;
      intervalMileage: number;
      nextDueDate: string;
      nextDueMileage: number;
      estimatedCost: number;
      estimatedHours: number;
      isActive: boolean;
    }>,
    actor?: Actor
  ) {
    await this.schedule(id, actor);

    return this.prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        ...data,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined
      }
    });
  }

  async removeSchedule(id: string, actor?: Actor) {
    await this.schedule(id, actor);
    return this.prisma.maintenanceSchedule.delete({ where: { id } });
  }

  async logs(query: MaintenanceLogQuery = {}, actor?: Actor) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_LOG_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_LOG_PAGE_SIZE));
    const tenantId = this.resolveTenantId(actor);

    const where: Prisma.MaintenanceLogWhereInput = {
      ...this.buildLogTenantWhere(tenantId)
    };
    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.maintenanceLog.count({ where }),
      this.prisma.maintenanceLog.findMany({
        where,
        include: {
          asset: true,
          vehicle: true,
          schedule: true,
          workOrder: true
        },
        orderBy: { performedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages
      }
    };
  }

  async createLog(data: {
    scheduleId?: string;
    assetId?: string;
    vehicleId?: string;
    workOrderId?: string;
    description: string;
    performedBy: string;
    performedAt: string;
    cost?: number;
    notes?: string;
    attachments?: string[];
  }, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    if (tenantId !== undefined) {
      if (data.scheduleId) {
        await this.schedule(data.scheduleId, actor);
      }

      if (data.assetId) {
        const asset = await this.prisma.asset.findFirst({ where: { id: data.assetId, tenantId } });
        if (!asset) {
          throw new NotFoundException("Asset not found in tenant context");
        }
      }

      if (data.vehicleId) {
        const vehicle = await this.prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId } });
        if (!vehicle) {
          throw new NotFoundException("Vehicle not found in tenant context");
        }
      }

      if (data.workOrderId) {
        const workOrder = await this.prisma.workOrder.findFirst({ where: { id: data.workOrderId, tenantId } });
        if (!workOrder) {
          throw new NotFoundException("Work order not found in tenant context");
        }
      }
    }

    return this.prisma.maintenanceLog.create({
      data: {
        ...data,
        performedAt: new Date(data.performedAt),
        attachments: data.attachments ?? []
      }
    });
  }

  async calendar(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        isActive: true,
        ...this.buildScheduleTenantWhere(tenantId)
      },
      select: {
        id: true,
        name: true,
        nextDueDate: true,
        vehicleId: true,
        assetId: true
      }
    });

    return schedules.map((item) => ({
      id: item.id,
      title: item.name,
      date: item.nextDueDate,
      vehicleId: item.vehicleId,
      assetId: item.assetId
    }));
  }

  async predictiveAlerts(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const alerts: Array<{
      id: string;
      type: string;
      riskLevel: RiskLevel;
      message: string;
      referenceId: string;
    }> = [];

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        nextServiceMileage: {
          not: null
        }
      }
    });

    for (const vehicle of vehicles) {
      const nextMileage = Number(vehicle.nextServiceMileage ?? 0);
      const currentMileage = Number(vehicle.currentMileage);

      if (nextMileage > 0 && currentMileage >= 0.8 * nextMileage) {
        alerts.push({
          id: `vehicle-mileage-${vehicle.id}`,
          type: "MILEAGE_THRESHOLD",
          riskLevel: RiskLevel.HIGH,
          message: `Vehicle ${vehicle.registrationNo} exceeded 80% of next service mileage`,
          referenceId: vehicle.id
        });
      }
    }

    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        ...this.buildScheduleTenantWhere(tenantId),
        intervalDays: {
          not: null
        }
      }
    });

    for (const schedule of schedules) {
      const lastLog = await this.prisma.maintenanceLog.findFirst({
        where: {
          scheduleId: schedule.id
        },
        orderBy: {
          performedAt: "desc"
        }
      });

      if (!lastLog || !schedule.intervalDays) {
        continue;
      }

      const elapsedMs = Date.now() - lastLog.performedAt.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

      if (elapsedDays >= schedule.intervalDays * 0.8) {
        alerts.push({
          id: `schedule-day-${schedule.id}`,
          type: "SCHEDULE_DUE",
          riskLevel: RiskLevel.HIGH,
          message: `Schedule ${schedule.name} exceeded 80% of interval days`,
          referenceId: schedule.id
        });
      }
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const groupedCorrective = await this.prisma.workOrder.groupBy({
      by: ["assetId"],
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        type: "CORRECTIVE",
        createdAt: {
          gte: since
        },
        assetId: {
          not: null
        }
      },
      _count: {
        _all: true
      }
    });

    groupedCorrective
      .filter((entry) => entry.assetId && entry._count._all >= 3)
      .forEach((entry) => {
        alerts.push({
          id: `asset-corrective-${entry.assetId}`,
          type: "FREQUENT_BREAKDOWN",
          riskLevel: RiskLevel.HIGH,
          message: `Asset ${entry.assetId} has 3+ corrective work orders in 30 days`,
          referenceId: String(entry.assetId)
        });
      });

    const fuelLogs = await this.prisma.fuelLog.findMany({
      where: {
        ...(tenantId !== undefined ? { vehicle: { tenantId } } : {})
      },
      orderBy: { date: "desc" },
      take: 120
    });

    const byVehicle = new Map<string, number[]>();
    for (const log of fuelLogs) {
      const bucket = byVehicle.get(log.vehicleId) ?? [];
      bucket.push(Number(log.liters));
      byVehicle.set(log.vehicleId, bucket);
    }

    for (const [vehicleId, litersList] of byVehicle.entries()) {
      if (litersList.length < 4) {
        continue;
      }

      const current = litersList[0];
      const historical = litersList.slice(1, 4);
      const average = historical.reduce((sum, value) => sum + value, 0) / historical.length;

      if (average > 0 && current > average * 1.15) {
        alerts.push({
          id: `fuel-consumption-${vehicleId}`,
          type: "FUEL_ANOMALY",
          riskLevel: RiskLevel.HIGH,
          message: `Vehicle ${vehicleId} fuel consumption increased by >15% against 3-month average`,
          referenceId: vehicleId
        });
      }
    }

    return alerts;
  }

  async acknowledgePredictiveAlert(id: string, actor?: Actor) {
    const [, referenceId] = id.split(/^[^-]+-[^-]+-/);
    const tenantId = this.resolveTenantId(actor);

    if (!referenceId) {
      throw new NotFoundException("Predictive alert not found");
    }

    if (tenantId !== undefined) {
      const asset = await this.prisma.asset.findFirst({ where: { id: referenceId, tenantId } });
      if (!asset) {
        throw new NotFoundException("Predictive alert target not found in tenant context");
      }
    }

    const log = await this.prisma.predictiveLog.create({
      data: {
        assetId: referenceId,
        prediction: "Alert acknowledged",
        confidence: 1,
        suggestedAction: "Review maintenance plan",
        riskLevel: RiskLevel.MEDIUM,
        acknowledged: true
      }
    });

    return log;
  }
}
