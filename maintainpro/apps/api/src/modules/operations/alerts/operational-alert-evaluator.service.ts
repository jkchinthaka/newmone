import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OperationalAlertSeverity } from "@prisma/client";

import { PrismaService } from "../../../database/prisma.service";
import { QueueHealthService } from "../../queues/queue-health.service";
import { OperationalAlertService } from "./operational-alert.service";

/**
 * Bounded periodic evaluator for application-level operational conditions.
 * Does not call real external notification channels.
 */
@Injectable()
export class OperationalAlertEvaluatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationalAlertEvaluatorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OperationalAlertService) private readonly alerts: OperationalAlertService,
    @Optional() @Inject(QueueHealthService) private readonly queueHealth?: QueueHealthService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService
  ) {}

  onModuleInit(): void {
    const enabled =
      String(this.configService?.get<string>("OPERATIONAL_ALERT_EVALUATOR_ENABLED") ?? "true")
        .trim()
        .toLowerCase() !== "false";
    if (!enabled) {
      return;
    }
    const intervalMs = Number(
      this.configService?.get<number>("OPERATIONAL_ALERT_EVALUATOR_INTERVAL_MS") ?? 60_000
    );
    this.timer = setInterval(() => {
      void this.evaluateOnce();
    }, Math.max(intervalMs, 15_000));
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async evaluateOnce() {
    if (this.running) {
      return { skipped: true, reason: "overlap" };
    }
    this.running = true;
    try {
      const results: string[] = [];

      const dbOk = await this.checkDatabase();
      if (!dbOk) {
        await this.alerts.observe({
          key: "primary_database_unavailable",
          fingerprint: "ops:primary_database_unavailable",
          severity: OperationalAlertSeverity.CRITICAL,
          source: "health",
          safeSummary: "Primary database check failed"
        });
        results.push("db_alert_open");
      } else {
        await this.alerts.resolveByFingerprint(
          "ops:primary_database_unavailable",
          "Primary database recovered"
        );
        results.push("db_alert_cleared");
      }

      const redisRequired =
        Boolean(this.configService?.get<boolean>("REDIS_REQUIRED_FOR_READINESS")) ||
        (this.configService?.get<string>("NODE_ENV") === "production" &&
          Boolean(this.configService?.get<boolean>("REDIS_REQUIRED_IN_PRODUCTION")));

      const redisFailed =
        redisRequired &&
        this.queueHealth &&
        this.isRedisConfigured() &&
        !this.queueHealth.isQueueOperational("notification");

      if (redisFailed) {
        await this.alerts.observe({
          key: "redis_unavailable_when_required",
          fingerprint: "ops:redis_unavailable_when_required",
          severity: OperationalAlertSeverity.HIGH,
          source: "queue",
          safeSummary: "Redis/queue unavailable while required for readiness"
        });
        results.push("redis_alert_open");
      } else if (redisRequired) {
        await this.alerts.resolveByFingerprint(
          "ops:redis_unavailable_when_required",
          "Redis/queue recovered"
        );
        results.push("redis_alert_cleared");
      }

      return { skipped: false, results };
    } catch (error) {
      this.logger.warn(`operational alert evaluation failed safely: ${(error as Error)?.message ?? "unknown"}`);
      return { skipped: false, results: ["evaluation_error_safe"] };
    } finally {
      this.running = false;
    }
  }

  private isRedisConfigured(): boolean {
    return Boolean(String(this.configService?.get<string>("REDIS_URL") ?? "").trim());
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.checkPrimary();
      return true;
    } catch {
      return false;
    }
  }
}
