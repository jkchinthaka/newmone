import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { resolveSafeBuildInfo } from "../../../common/utils/build-info.util";
import { PrismaService } from "../../../database/prisma.service";
import { QueueHealthService } from "../../queues/queue-health.service";
import { QueueStartupReconciliationService } from "../../queues/reconciliation/queue-startup-reconciliation.service";
import { OperationalAlertService } from "./operational-alert.service";

/**
 * Low-cardinality protected JSON operational snapshot (not Prometheus scrape).
 * Forbidden labels: email, userId, requestId, work-order ID, PO ID.
 */
@Injectable()
export class OperationalMetricsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
    @Optional() @Inject(QueueHealthService) private readonly queueHealth?: QueueHealthService,
    @Optional()
    @Inject(QueueStartupReconciliationService)
    private readonly reconciliation?: QueueStartupReconciliationService,
    @Optional() @Inject(OperationalAlertService) private readonly alerts?: OperationalAlertService
  ) {}

  async getSnapshot() {
    const build = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") =>
      this.configService?.get<string>(key, fallback) ?? fallback
    );

    let databaseState: "up" | "down" = "down";
    let databaseLatencyMs: number | null = null;
    const started = performance.now();
    try {
      await this.prisma.checkPrimary();
      databaseState = "up";
      databaseLatencyMs = Math.round(performance.now() - started);
    } catch {
      databaseState = "down";
      databaseLatencyMs = Math.round(performance.now() - started);
    }

    let queuePresent = false;
    if (this.queueHealth) {
      try {
        await this.queueHealth.getRedisAndQueueHealth();
        queuePresent = true;
      } catch {
        queuePresent = false;
      }
    }

    const openAlerts = (await this.alerts?.listActive(20)) ?? [];
    const reconciliationStatus = this.reconciliation?.getStatus() ?? {
      state: "unknown",
      lastRunAt: null
    };

    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      service: "maintainpro-api",
      build: {
        version: build.version,
        commit: build.commitSha
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
      },
      database: {
        state: databaseState,
        checkLatencyMs: databaseLatencyMs
      },
      redisQueues: {
        redisConfigured: Boolean(String(this.configService?.get<string>("REDIS_URL") ?? "").trim()),
        snapshotPresent: queuePresent,
        reconciliation: reconciliationStatus
      },
      alerts: {
        openCount: openAlerts.length,
        severities: openAlerts.reduce(
          (acc: Record<string, number>, row: { severity: string }) => {
            acc[row.severity] = (acc[row.severity] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      },
      cardinalityNote: "No requestId, email, userId, or entity-id labels are emitted"
    };
  }
}
