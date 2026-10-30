import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PmPlanStatus, RoleName } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { PlanningService } from "./planning.service";

/**
 * Scheduled service jobs are created by the system, not by someone pressing a button per plan.
 * Every interval (default hourly) each ACTIVE plan with "auto create job" is checked:
 * - calendar triggers use today's date;
 * - km triggers use the vehicle's current odometer from Fleet;
 * - hour / meter triggers use the linked machine meter's current value.
 * Generation keys keep this safe to run on several API instances or repeatedly.
 */
export type PmSweepPlan = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  nextDueMeterId: string | null;
  vehicle?: { currentMileage: number | null } | null;
  triggers?: Array<{ kind: string; meterId: string | null; isActive: boolean }>;
};

/** Meter value the plan's triggers should be checked against (undefined when there is none). */
export function sweepMeterValue(
  plan: PmSweepPlan,
  meterValues: Map<string, number>
): number | undefined {
  const meterTriggers = (plan.triggers ?? []).filter((trigger) => trigger.isActive && trigger.kind === "METER");
  if (meterTriggers.length === 0) return undefined;
  if (plan.vehicleId && plan.vehicle && plan.vehicle.currentMileage != null) {
    return Number(plan.vehicle.currentMileage);
  }
  const meterId = plan.nextDueMeterId ?? meterTriggers.find((trigger) => trigger.meterId)?.meterId ?? null;
  if (meterId && meterValues.has(meterId)) return meterValues.get(meterId);
  return undefined;
}

@Injectable()
export class PmAutoSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PmAutoSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PlanningService) private readonly planning: PlanningService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService
  ) {}

  onModuleInit(): void {
    const enabled = String(this.config?.get<string>("PM_AUTO_SCHEDULER_ENABLED") ?? "true").toLowerCase() !== "false";
    if (!enabled || process.env.NODE_ENV === "test") return;
    const minutes = Number(this.config?.get<number>("PM_AUTO_SCHEDULER_INTERVAL_MINUTES") ?? 60);
    const intervalMs = Math.max(5, Number.isFinite(minutes) ? minutes : 60) * 60_000;
    // First run shortly after boot, then on the interval.
    const first = setTimeout(() => void this.runOnce(), 60_000);
    first.unref?.();
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(now = new Date()): Promise<{ checked: number; created: number; failed: number }> {
    if (this.running) return { checked: 0, created: 0, failed: 0 };
    this.running = true;
    let checked = 0;
    let created = 0;
    let failed = 0;
    try {
      const plans = (await this.prisma.pmPlan.findMany({
        where: {
          status: PmPlanStatus.ACTIVE,
          autoCreateWorkOrder: true,
          OR: [{ assetId: { not: null } }, { vehicleId: { not: null } }]
        },
        select: {
          id: true,
          tenantId: true,
          vehicleId: true,
          nextDueMeterId: true,
          vehicle: { select: { currentMileage: true } },
          triggers: { select: { kind: true, meterId: true, isActive: true } }
        },
        take: 2000
      })) as PmSweepPlan[];

      const meterIds = new Set<string>();
      for (const plan of plans) {
        if (plan.nextDueMeterId) meterIds.add(plan.nextDueMeterId);
        for (const trigger of plan.triggers ?? []) if (trigger.meterId) meterIds.add(trigger.meterId);
      }
      const meterValues = new Map<string, number>();
      if (meterIds.size > 0) {
        const meters = await this.prisma.assetMeter.findMany({
          where: { id: { in: [...meterIds] } },
          select: { id: true, currentValue: true }
        });
        for (const meter of meters) meterValues.set(meter.id, Number(meter.currentValue));
      }

      const actors = new Map<string, { sub: string; tenantId: string; role: string; email: string } | null>();
      for (const plan of plans) {
        checked += 1;
        if (!actors.has(plan.tenantId)) actors.set(plan.tenantId, await this.systemActor(plan.tenantId));
        const actor = actors.get(plan.tenantId);
        if (!actor) continue;
        try {
          const result = await this.planning.autoCreateWorkOrderIfDue(actor as never, plan.id, {
            now,
            currentMeterValue: sweepMeterValue(plan, meterValues)
          });
          if (result.created) created += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn(`Scheduled service check failed for plan ${plan.id}: ${(error as Error)?.message ?? "unknown"}`);
        }
      }
      if (created > 0) this.logger.log(`Scheduled service: ${created} job(s) created from ${checked} plan(s).`);
    } catch (error) {
      this.logger.warn(`Scheduled service sweep failed: ${(error as Error)?.message ?? "unknown"}`);
    } finally {
      this.running = false;
    }
    return { checked, created, failed };
  }

  /** Jobs need a creator: the tenant's first active Admin (or Super Admin). */
  private async systemActor(tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, isActive: true, role: { name: { in: [RoleName.ADMIN, RoleName.SUPER_ADMIN] } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: { select: { name: true } } }
    });
    if (!user) return null;
    return { sub: user.id, tenantId, role: String(user.role?.name ?? RoleName.ADMIN), email: user.email ?? "" };
  }
}
