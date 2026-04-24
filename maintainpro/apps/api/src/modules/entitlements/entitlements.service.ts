import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { EntitlementType, UsageEventType, UsageMetricWindow } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class EntitlementsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private getMonthlyWindow(anchor = new Date()) {
    const periodStart = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    const periodEnd = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 0, 0, 0, 0)
    );

    return { periodStart, periodEnd };
  }

  async getCurrentSubscription(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        isCurrent: true
      },
      include: {
        plan: {
          include: {
            entitlements: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  async listEntitlements(tenantId: string) {
    const subscription = await this.getCurrentSubscription(tenantId);
    return subscription?.plan.entitlements ?? [];
  }

  async getEntitlement(tenantId: string, key: string) {
    const entitlements = await this.listEntitlements(tenantId);
    return entitlements.find((entry) => entry.key === key) ?? null;
  }

  async getCurrentUsageValue(tenantId: string, key: string): Promise<number> {
    if (key === "users.max") {
      return this.prisma.user.count({
        where: {
          tenantId,
          isActive: true
        }
      });
    }

    if (key === "assets.max") {
      return this.prisma.asset.count({
        where: {
          tenantId,
          archivedAt: null
        }
      });
    }

    if (key === "work_orders.monthly") {
      const { periodStart, periodEnd } = this.getMonthlyWindow();
      return this.prisma.workOrder.count({
        where: {
          tenantId,
          createdAt: {
            gte: periodStart,
            lt: periodEnd
          }
        }
      });
    }

    const { periodStart } = this.getMonthlyWindow();
    const metric = await this.prisma.usageMetric.findUnique({
      where: {
        tenantId_key_window_periodStart: {
          tenantId,
          key,
          window: UsageMetricWindow.MONTHLY,
          periodStart
        }
      },
      select: {
        value: true
      }
    });

    return metric?.value ?? 0;
  }

  async assertEntitlement(tenantId: string, key: string, quantity = 1) {
    const entitlement = await this.getEntitlement(tenantId, key);

    if (!entitlement) {
      return {
        allowed: true,
        reason: "not_configured",
        used: 0,
        limit: null
      };
    }

    if (entitlement.type === EntitlementType.FEATURE) {
      return {
        allowed: entitlement.enabled,
        reason: entitlement.enabled ? "ok" : "feature_disabled",
        used: 0,
        limit: null
      };
    }

    if (!entitlement.limitValue || entitlement.limitValue <= 0) {
      return {
        allowed: true,
        reason: "unlimited",
        used: 0,
        limit: null
      };
    }

    const used = await this.getCurrentUsageValue(tenantId, key);
    const requestedQuantity = Math.max(0, Number(quantity) || 0);
    const allowed = used + requestedQuantity <= entitlement.limitValue;

    return {
      allowed,
      reason: allowed ? "ok" : "limit_reached",
      used,
      limit: entitlement.limitValue
    };
  }

  async recordUsage(
    tenantId: string,
    key: string,
    quantity: number,
    eventType: UsageEventType = UsageEventType.CONSUME,
    metadata?: Record<string, unknown>
  ) {
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    const { periodStart, periodEnd } = this.getMonthlyWindow();

    await this.prisma.usageEvent.create({
      data: {
        tenantId,
        key,
        eventType,
        quantity: safeQuantity,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : undefined
      }
    });

    if (eventType === UsageEventType.RESET) {
      await this.prisma.usageMetric.upsert({
        where: {
          tenantId_key_window_periodStart: {
            tenantId,
            key,
            window: UsageMetricWindow.MONTHLY,
            periodStart
          }
        },
        update: {
          value: 0,
          periodEnd
        },
        create: {
          tenantId,
          key,
          window: UsageMetricWindow.MONTHLY,
          periodStart,
          periodEnd,
          value: 0
        }
      });

      return;
    }

    const incrementBy =
      eventType === UsageEventType.CREDIT ? -safeQuantity : safeQuantity;

    await this.prisma.usageMetric.upsert({
      where: {
        tenantId_key_window_periodStart: {
          tenantId,
          key,
          window: UsageMetricWindow.MONTHLY,
          periodStart
        }
      },
      update: {
        periodEnd,
        value: {
          increment: incrementBy
        }
      },
      create: {
        tenantId,
        key,
        window: UsageMetricWindow.MONTHLY,
        periodStart,
        periodEnd,
        value: Math.max(0, incrementBy)
      }
    });
  }

  async getUsageSnapshot(tenantId: string) {
    const subscription = await this.getCurrentSubscription(tenantId);
    const entitlements = subscription?.plan.entitlements ?? [];

    const usage = await Promise.all(
      entitlements
        .filter((entry) => entry.type === EntitlementType.LIMIT)
        .map(async (entry) => {
          const used = await this.getCurrentUsageValue(tenantId, entry.key);
          const limit = entry.limitValue ?? null;

          return {
            key: entry.key,
            unit: entry.unit,
            used,
            limit,
            remaining: typeof limit === "number" ? Math.max(0, limit - used) : null,
            percent: typeof limit === "number" && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null
          };
        })
    );

    return {
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            seats: subscription.seats,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            plan: {
              id: subscription.plan.id,
              code: subscription.plan.code,
              name: subscription.plan.name
            }
          }
        : null,
      entitlements,
      usage,
      generatedAt: new Date()
    };
  }
}
