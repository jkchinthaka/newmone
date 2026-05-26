import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import type { Phase4Actor } from "../_phase4/phase4-audit.helper";
import { resolveTenantId } from "../_phase4/phase4-audit.helper";

@Injectable()
export class FuelService {
  constructor(private readonly prisma: PrismaService) {}

  allLogs(actor: Phase4Actor) {
    const tenantId = resolveTenantId(actor);
    return this.prisma.fuelLog.findMany({
      where: {
        ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
      },
      include: { vehicle: true },
      orderBy: { date: "desc" }
    });
  }

  async analytics(actor: Phase4Actor) {
    const tenantId = resolveTenantId(actor);
    const logs = await this.prisma.fuelLog.findMany({
      where: {
        ...(tenantId !== undefined ? { vehicle: { is: { tenantId } } } : {})
      },
      include: {
        vehicle: {
          select: {
            id: true,
            registrationNo: true,
            vehicleModel: true
          }
        }
      },
      orderBy: [{ vehicleId: "asc" }, { mileageAtFuel: "asc" }, { date: "asc" }]
    });

    const totalLiters = logs.reduce((sum, log) => sum + Number(log.liters), 0);
    const totalCost = logs.reduce((sum, log) => sum + Number(log.totalCost), 0);
    const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;
    const byVehicle = new Map<string, typeof logs>();

    for (const log of logs) {
      const current = byVehicle.get(log.vehicleId) ?? [];
      current.push(log);
      byVehicle.set(log.vehicleId, current);
    }

    const intervals: Array<{
      vehicleId: string;
      registrationNo: string | null;
      date: Date;
      liters: number;
      distance: number;
      litersPer100Km: number;
    }> = [];
    for (const entry of byVehicle.entries()) {
      const sorted = [...entry[1]].sort((left, right) => {
        const mileageDiff = Number(left.mileageAtFuel) - Number(right.mileageAtFuel);
        if (mileageDiff !== 0) {
          return mileageDiff;
          }
        return left.date.getTime() - right.date.getTime();
      });

      for (var index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const distance = Number(current.mileageAtFuel) - Number(previous.mileageAtFuel);
        if (distance <= 0) {
          continue;
        }
        intervals.push({
          vehicleId: current.vehicleId,
          registrationNo: current.vehicle?.registrationNo ?? null,
          date: current.date,
          liters: Number(current.liters),
          distance,
          litersPer100Km: (Number(current.liters) / distance) * 100
        });
      }
    }

    const avgConsumption =
      intervals.length > 0
        ? intervals.reduce((sum, item) => sum + item.litersPer100Km, 0) / intervals.length
        : 0;
    const anomalies = intervals.filter((item) => {
      const usage = item.litersPer100Km;
      const liters = item.liters;
      const distance = item.distance;
      return (avgConsumption > 0 && (usage > avgConsumption * 1.35 || usage < avgConsumption * 0.55)) || (distance < 25 && liters > 12);
    });

    const monthlyTrend = new Map<string, { totalCost: number; liters: number }>();
    for (const log of logs) {
      const key = log.date.toISOString().slice(0, 7);
      const current = monthlyTrend.get(key) ?? { totalCost: 0, liters: 0 };
      current.totalCost += Number(log.totalCost);
      current.liters += Number(log.liters);
      monthlyTrend.set(key, current);
    }

    return {
      totalLiters,
      totalCost,
      avgCostPerLiter,
      avgConsumption,
      distance: intervals.reduce((sum, item) => sum + item.distance, 0),
      abnormalUsageCount: anomalies.length,
      anomalies: anomalies.map((item) => ({
        vehicleId: item.vehicleId,
        registrationNo: item.registrationNo,
        date: item.date.toISOString(),
        litersPer100Km: item.litersPer100Km,
        distance: item.distance,
        liters: item.liters
      })),
      monthlyTrend: [...monthlyTrend.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([period, value]) => ({
          period,
          totalCost: value.totalCost,
          liters: value.liters
        }))
    };
  }
}
