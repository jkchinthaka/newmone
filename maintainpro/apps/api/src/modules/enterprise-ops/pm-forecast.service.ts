import { Injectable } from "@nestjs/common";
import { Prisma, WorkOrderType } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { forecastServiceDue, nextPreventiveDue } from "../policies/maintenance-policies";
import { DataQualityService } from "./data-quality.service";
import { DomainNotificationService } from "./domain-notification.service";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

@Injectable()
export class PmForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
    private readonly notifications: DomainNotificationService
  ) {}

  async advanceOnWorkOrderCompleted(workOrder: {
    id: string;
    tenantId?: string | null;
    type: WorkOrderType;
    scheduleId?: string | null;
    vehicleId?: string | null;
    completedDate?: Date | null;
    actualHours?: number | null;
    verificationStatus?: string | null;
  }) {
    if (workOrder.type !== WorkOrderType.PREVENTIVE || !workOrder.scheduleId) {
      return null;
    }
    if (workOrder.verificationStatus && workOrder.verificationStatus !== "VERIFIED" && workOrder.verificationStatus !== "NOT_REQUIRED") {
      return null;
    }
    const tenantId = workOrder.tenantId;
    if (!tenantId) {
      return null;
    }
    const schedule = await this.prisma.maintenanceSchedule.findFirst({
      where: { id: workOrder.scheduleId, OR: [{ vehicle: { tenantId } }, { asset: { tenantId } }] }
    });
    if (!schedule?.isActive) {
      return null;
    }
    const vehicle = schedule.vehicleId
      ? await this.prisma.vehicle.findFirst({ where: { id: schedule.vehicleId, tenantId } })
      : null;
    const completedAt = workOrder.completedDate ?? new Date();
    const result = nextPreventiveDue({
      policy: schedule.advancePolicy === "FIXED_SCHEDULE" ? "FIXED_SCHEDULE" : "ACTUAL_COMPLETION",
      completedAt,
      completedMileage: vehicle?.currentMileage ?? null,
      completedHours: workOrder.actualHours ?? null,
      previousDueDate: schedule.nextDueDate,
      previousDueMileage: schedule.nextDueMileage,
      previousDueHours: schedule.nextDueHours,
      intervalDays: schedule.intervalDays,
      intervalMileage: schedule.intervalMileage,
      intervalHours: schedule.intervalHours
    });
    if (!result.allowed) {
      await this.dataQuality.upsertOpen({
        tenantId,
        ruleCode: result.code,
        severity: "HIGH",
        entityType: "MaintenanceSchedule",
        entityId: schedule.id,
        module: "maintenance",
        messageCode: result.code,
        metadata: result.metadata
      });
      return result;
    }
    await this.prisma.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: {
        lastCompletedAt: completedAt,
        lastCompletedMileage: vehicle?.currentMileage ?? schedule.lastCompletedMileage,
        lastCompletedHours: workOrder.actualHours ?? schedule.lastCompletedHours,
        nextDueDate: result.nextDueDate ?? undefined,
        nextDueMileage: result.nextDueMileage ?? undefined,
        nextDueHours: result.nextDueHours ?? undefined
      }
    });
    return result;
  }

  async refreshForecasts(actor: Actor, horizonDays = 14) {
    const tenantId = requireTenantId(actor.tenantId);
    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: {
        isActive: true,
        OR: [{ vehicle: { tenantId } }, { asset: { tenantId } }]
      },
      include: { vehicle: true },
      take: 500
    });
    const rows = [];
    for (const schedule of schedules) {
      const vehicle = schedule.vehicle;
      const avg = vehicle ? await this.averageDailyKm(tenantId, vehicle.id) : { avgKmPerDay: null, sampleDays: 0 };
      const forecast = forecastServiceDue({
        currentMileage: vehicle?.currentMileage ?? null,
        nextDueMileage: schedule.nextDueMileage,
        nextDueDate: schedule.nextDueDate,
        avgKmPerDay: avg.avgKmPerDay,
        sampleDays: avg.sampleDays
      });
      const shortageParts = await this.forecastPartShortage(tenantId, schedule, horizonDays, forecast);
      const saved = await this.prisma.maintenanceForecast.upsert({
        where: { tenantId_scheduleId: { tenantId, scheduleId: schedule.id } },
        update: {
          vehicleId: vehicle?.id,
          estimatedDueDate: forecast.estimatedDueDate,
          remainingKm: forecast.remainingKm,
          remainingDays: forecast.remainingDays,
          avgKmPerDay: forecast.avgKmPerDay,
          coverage: forecast.coverage,
          confidence: forecast.confidence,
          shortageParts: shortageParts as Prisma.InputJsonValue
        },
        create: {
          tenantId,
          scheduleId: schedule.id,
          vehicleId: vehicle?.id,
          estimatedDueDate: forecast.estimatedDueDate,
          remainingKm: forecast.remainingKm,
          remainingDays: forecast.remainingDays,
          avgKmPerDay: forecast.avgKmPerDay,
          coverage: forecast.coverage,
          confidence: forecast.confidence,
          shortageParts: shortageParts as Prisma.InputJsonValue
        }
      });
      if (forecast.coverage !== "INSUFFICIENT_DATA" && forecast.remainingDays != null && forecast.remainingDays <= 7) {
        await this.notifications.emit({
          type: forecast.remainingDays < 0 ? "MAINTENANCE_OVERDUE" : "MAINTENANCE_DUE_SOON",
          tenantId,
          entityType: "MaintenanceSchedule",
          entityId: schedule.id,
          severity: forecast.remainingDays < 0 ? "CRITICAL" : "WARNING",
          metadata: { remainingDays: forecast.remainingDays, vehicleId: vehicle?.id }
        });
      }
      rows.push(saved);
    }
    return rows;
  }

  async listForecasts(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.maintenanceForecast.findMany({
      where: { tenantId },
      include: { schedule: true },
      orderBy: { estimatedDueDate: "asc" },
      take: 200
    });
  }

  async upcomingPartDemand(tenantId: string, horizonDays: number): Promise<Map<string, number>> {
    const horizon = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
    const forecasts = await this.prisma.maintenanceForecast.findMany({
      where: {
        tenantId,
        OR: [{ estimatedDueDate: { lte: horizon } }, { remainingDays: { lte: horizonDays } }]
      },
      include: { schedule: true }
    });
    const demand = new Map<string, number>();
    for (const row of forecasts) {
      const shortage = Array.isArray(row.shortageParts) ? row.shortageParts : [];
      for (const item of shortage as Array<{ partId?: string; required?: number }>) {
        if (!item.partId) continue;
        demand.set(item.partId, (demand.get(item.partId) ?? 0) + Number(item.required ?? 0));
      }
    }
    return demand;
  }

  private async forecastPartShortage(
    tenantId: string,
    schedule: { id: string },
    horizonDays: number,
    forecast: { remainingDays: number | null; coverage: string }
  ) {
    if (forecast.coverage === "INSUFFICIENT_DATA") {
      return [];
    }
    if (forecast.remainingDays != null && forecast.remainingDays > horizonDays) {
      return [];
    }
    const recentWo = await this.prisma.workOrder.findFirst({
      where: { tenantId, scheduleId: schedule.id },
      orderBy: { createdAt: "desc" },
      include: { parts: true }
    });
    const required = recentWo?.parts ?? [];
    const result = [];
    for (const line of required) {
      const part = await this.prisma.sparePart.findFirst({
        where: { id: line.partId, tenantId },
        select: { id: true, availableQuantity: true, name: true, partNumber: true }
      });
      if (!part) continue;
      const needed = Math.max(1, line.requestedQuantity ?? 1);
      const available = part.availableQuantity ?? 0;
      result.push({
        partId: part.id,
        partNumber: part.partNumber,
        required: needed,
        available,
        shortage: Math.max(0, needed - available)
      });
    }
    return result;
  }

  private async averageDailyKm(tenantId: string, vehicleId: string): Promise<{ avgKmPerDay: number | null; sampleDays: number }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.vehicleMeterLog.findMany({
      where: { vehicleId, createdAt: { gte: since }, vehicle: { tenantId } },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: { reading: true, createdAt: true }
    });
    if (logs.length < 3) {
      return { avgKmPerDay: null, sampleDays: logs.length };
    }
    const first = logs[0];
    const last = logs[logs.length - 1];
    const days = Math.max(1, (last.createdAt.getTime() - first.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const delta = Number(last.reading) - Number(first.reading);
    if (delta <= 0) {
      return { avgKmPerDay: null, sampleDays: days };
    }
    return { avgKmPerDay: delta / days, sampleDays: days };
  }
}
