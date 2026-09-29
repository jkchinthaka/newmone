import { Injectable } from "@nestjs/common";
import { Prisma, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { forecastServiceDue, nextPreventiveDue, classifyStoredForecast } from "../policies/maintenance-policies";
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
    const planned = await this.listPlanner(actor, {});
    return planned.items;
  }

  async listPlanner(
    actor: Actor,
    query: {
      horizon?: string;
      dueWindow?: string;
      confidence?: string;
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      sort?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const horizonDays =
      query.horizon === "7" ? 7 : query.horizon === "90" ? 90 : query.horizon === "180" ? 180 : 30;
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 25) || 25, 1), 100);
    const rows = await this.prisma.maintenanceForecast.findMany({
      where: { tenantId },
      include: {
        schedule: {
          include: {
            asset: {
              select: { id: true, name: true, assetTag: true, status: true, criticalityLevel: true }
            },
            vehicle: {
              select: {
                id: true,
                registrationNo: true,
                assetTag: true,
                make: true,
                vehicleModel: true,
                currentMileage: true,
                status: true
              }
            },
            workOrders: {
              where: {
                tenantId,
                status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED] }
              },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, woNumber: true, status: true }
            }
          }
        }
      }
    });

    const now = new Date();
    const mapped = rows
      .map((row) => this.toPlannerItem(row, horizonDays, now))
      .filter((item) => item != null);

    const summary = {
      dueIn7: mapped.filter((item) => item.status === "DUE_SOON" || (item.remainingDays != null && item.remainingDays >= 0 && item.remainingDays <= 7)).length,
      dueIn30: mapped.filter((item) => item.remainingDays != null && item.remainingDays >= 0 && item.remainingDays <= 30 && item.status !== "INSUFFICIENT_DATA").length,
      overdue: mapped.filter((item) => item.status === "OVERDUE").length,
      insufficient: mapped.filter((item) => item.status === "INSUFFICIENT_DATA").length,
      lastCalculated: rows.reduce<Date | null>((latest, row) => {
        if (!latest || row.updatedAt > latest) return row.updatedAt;
        return latest;
      }, null)
    };

    const search = query.search?.trim().toLowerCase() ?? "";
    let filtered = mapped.filter((item) => {
      if (search) {
        const haystack = [item.assetName, item.assetCode, item.taskName, item.planCode, item.locationLabel, item.workOrder?.woNumber]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (query.confidence && item.confidence !== query.confidence.toUpperCase()) return false;
      if (query.status && item.status !== query.status.toUpperCase().replace(/-/g, "_")) return false;
      if (query.dueWindow === "overdue" && item.status !== "OVERDUE") return false;
      if (query.dueWindow === "7" && !(item.remainingDays != null && item.remainingDays >= 0 && item.remainingDays <= 7)) return false;
      if (query.dueWindow === "30" && !(item.remainingDays != null && item.remainingDays >= 0 && item.remainingDays <= 30)) return false;
      if (query.dueWindow === "90" && !(item.remainingDays != null && item.remainingDays >= 0 && item.remainingDays <= 90)) return false;
      if (query.dueWindow === "beyond" && !(item.remainingDays != null && item.remainingDays > 90)) return false;
      if (query.horizon && item.status !== "INSUFFICIENT_DATA" && item.remainingDays != null && item.remainingDays > horizonDays && query.dueWindow !== "all" && query.dueWindow !== "beyond") {
        return false;
      }
      return true;
    });

    const sort = query.sort ?? "soonest";
    filtered = filtered.sort((a, b) => {
      if (sort === "asset") return a.assetName.localeCompare(b.assetName);
      if (sort === "confidence") return confidenceRank(a.confidence) - confidenceRank(b.confidence);
      if (sort === "overdue") return (a.remainingDays ?? 9999) - (b.remainingDays ?? 9999);
      const aDays = a.remainingDays ?? 99999;
      const bDays = b.remainingDays ?? 99999;
      return aDays - bDays;
    });

    const total = filtered.length;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return {
      items,
      summary: {
        ...summary,
        lastCalculated: summary.lastCalculated?.toISOString() ?? null
      },
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }

  private toPlannerItem(
    row: {
      id: string;
      updatedAt: Date;
      estimatedDueDate: Date | null;
      remainingKm: number | null;
      remainingDays: number | null;
      avgKmPerDay: number | null;
      coverage: string;
      confidence: string | null;
      schedule: {
        id: string;
        name: string;
        intervalDays: number | null;
        intervalMileage: number | null;
        intervalHours: number | null;
        nextDueDate: Date | null;
        nextDueMileage: number | null;
        nextDueHours: number | null;
        lastCompletedAt: Date | null;
        lastCompletedMileage: number | null;
        estimatedHours: number | null;
        isActive: boolean;
        asset: { id: string; name: string; assetTag: string; status: string; criticalityLevel: string | null } | null;
        vehicle: {
          id: string;
          registrationNo: string;
          assetTag: string | null;
          make: string;
          vehicleModel: string;
          currentMileage: number;
          status: string;
        } | null;
        workOrders: Array<{ id: string; woNumber: string; status: string }>;
      };
    },
    horizonDays: number,
    now: Date
  ) {
    const schedule = row.schedule;
    const inactive =
      !schedule.isActive ||
      ["INACTIVE", "DISPOSED", "RETIRED", "OUT_OF_SERVICE"].includes(String(schedule.asset?.status ?? "").toUpperCase()) ||
      ["INACTIVE", "DISPOSED", "RETIRED", "OUT_OF_SERVICE"].includes(String(schedule.vehicle?.status ?? "").toUpperCase());
    if (inactive) return null;

    const classified = classifyStoredForecast({
      coverage: row.coverage,
      remainingDays: row.remainingDays,
      estimatedDueDate: row.estimatedDueDate,
      now,
      horizonDays
    });
    const vehicle = schedule.vehicle;
    const asset = schedule.asset;
    const assetName = vehicle
      ? `${vehicle.make} ${vehicle.vehicleModel}`.trim() || vehicle.registrationNo
      : asset?.name || "Unnamed asset";
    const assetCode = vehicle?.registrationNo || vehicle?.assetTag || asset?.assetTag || "—";
    const unit = schedule.intervalHours ? "hrs" : schedule.intervalMileage || vehicle ? "km" : "hrs";
    const currentUsage = vehicle?.currentMileage ?? schedule.lastCompletedMileage ?? null;
    let reason: string | null = null;
    if (classified.status === "INSUFFICIENT_DATA") {
      if (!schedule.nextDueDate && schedule.nextDueMileage == null && schedule.nextDueHours == null) {
        reason = "No maintenance interval configured";
      } else if (row.avgKmPerDay == null) {
        reason = "No valid recent usage trend";
      } else {
        reason = "Not enough reliable meter history";
      }
    }

    return {
      id: row.id,
      scheduleId: schedule.id,
      assetName,
      assetCode,
      criticality: asset?.criticalityLevel ?? null,
      taskName: schedule.name,
      planCode: schedule.id.slice(0, 8).toUpperCase(),
      locationLabel: null as string | null,
      currentUsage,
      usageUnit: unit,
      estimatedDueDate: row.estimatedDueDate?.toISOString() ?? null,
      remainingDays: row.remainingDays,
      remainingUsage: row.remainingKm,
      avgPerDay: row.avgKmPerDay,
      confidence: row.confidence && row.confidence !== "NONE" ? row.confidence : "INSUFFICIENT",
      dataQuality: classified.dataQuality,
      status: classified.status,
      reason,
      intervalLabel: schedule.intervalMileage
        ? `Every ${schedule.intervalMileage} km`
        : schedule.intervalHours
          ? `Every ${schedule.intervalHours} hrs`
          : schedule.intervalDays
            ? `Every ${schedule.intervalDays} days`
            : null,
      lastCompletedAt: schedule.lastCompletedAt?.toISOString() ?? null,
      lastCompletedUsage: schedule.lastCompletedMileage,
      nextThreshold: schedule.nextDueMileage ?? schedule.nextDueHours,
      estimatedDowntimeHours: schedule.estimatedHours,
      updatedAt: row.updatedAt.toISOString(),
      workOrder: schedule.workOrders[0]
        ? { id: schedule.workOrders[0].id, woNumber: schedule.workOrders[0].woNumber, status: schedule.workOrders[0].status }
        : null
    };
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

function confidenceRank(value: string) {
  if (value === "LOW") return 0;
  if (value === "MEDIUM") return 1;
  if (value === "HIGH") return 2;
  return 3;
}
