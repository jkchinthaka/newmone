import { Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { NotificationChannel } from "@prisma/client";

import { sanitizeLogText } from "../../../common/logging/sanitize-for-log.util";
import { PrismaService } from "../../../database/prisma.service";
import { QueueHealthService } from "../queue-health.service";

export type ReconciliationStatus = {
  state: "idle" | "running" | "completed" | "degraded" | "disabled" | "unknown";
  lastRunAt: string | null;
  lastEnqueued: number;
  lastSkipped: number;
  lastErrorSafe: string | null;
};

/** Policy B: MongoDB Notification rows are authoritative; Redis jobs rebuild with stable job IDs. */
@Injectable()
export class QueueStartupReconciliationService implements OnModuleInit {
  private readonly logger = new Logger(QueueStartupReconciliationService.name);
  private status: ReconciliationStatus = {
    state: "idle",
    lastRunAt: null,
    lastEnqueued: 0,
    lastSkipped: 0,
    lastErrorSafe: null
  };
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @InjectQueue("notifications") private readonly notificationsQueue?: Queue,
    @Optional() @Inject(QueueHealthService) private readonly queueHealth?: QueueHealthService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService
  ) {}

  getStatus(): ReconciliationStatus {
    return { ...this.status };
  }

  async onModuleInit(): Promise<void> {
    const enabled =
      String(this.configService?.get<string>("QUEUE_STARTUP_RECONCILIATION_ENABLED") ?? "true")
        .trim()
        .toLowerCase() !== "false";
    if (!enabled) {
      this.status.state = "disabled";
      return;
    }
    setTimeout(() => {
      void this.reconcileNotifications();
    }, 2_000).unref?.();
  }

  async reconcileNotifications(options?: { force?: boolean }) {
    if (this.running && !options?.force) {
      return this.status;
    }

    if (!this.notificationsQueue || !this.queueHealth?.isQueueOperational("notification")) {
      this.status = {
        ...this.status,
        state: "degraded",
        lastErrorSafe: "queue_not_operational",
        lastRunAt: new Date().toISOString()
      };
      return this.status;
    }

    this.running = true;
    this.status.state = "running";
    let enqueued = 0;
    let skipped = 0;

    try {
      const batchSize = Math.min(
        Math.max(Number(this.configService?.get<number>("QUEUE_RECONCILE_BATCH_SIZE") ?? 50), 1),
        200
      );

      const pending = await this.prisma.notification.findMany({
        where: {
          sentAt: null,
          channel: {
            in: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH]
          }
        },
        orderBy: { createdAt: "asc" },
        take: batchSize,
        select: {
          id: true,
          userId: true,
          title: true,
          message: true,
          channel: true,
          metadata: true
        }
      });

      for (const row of pending) {
        const jobId = `notification:${row.id}`;
        try {
          const existing = await this.notificationsQueue.getJob(jobId);
          if (existing) {
            skipped += 1;
            continue;
          }
          await this.notificationsQueue.add(
            "send",
            {
              channel: row.channel,
              userId: row.userId,
              message: row.message,
              title: row.title,
              notificationId: row.id,
              metadata: row.metadata
            },
            {
              jobId,
              attempts: 3,
              backoff: { type: "exponential", delay: 30_000 },
              removeOnComplete: true,
              removeOnFail: false
            }
          );
          enqueued += 1;
        } catch (error) {
          const msg = sanitizeLogText((error as Error)?.message ?? "enqueue_failed", 200);
          if (/job.*(exist|duplicate)/i.test(msg)) {
            skipped += 1;
            continue;
          }
          this.logger.warn("queue reconcile skip job: " + msg);
          skipped += 1;
        }
      }

      this.status = {
        state: "completed",
        lastRunAt: new Date().toISOString(),
        lastEnqueued: enqueued,
        lastSkipped: skipped,
        lastErrorSafe: null
      };
      this.logger.log(
        sanitizeLogText(
          JSON.stringify({
            event: "queue_startup_reconciliation_completed",
            enqueued,
            skipped
          }),
          400
        )
      );
      return this.status;
    } catch (error) {
      this.status = {
        state: "degraded",
        lastRunAt: new Date().toISOString(),
        lastEnqueued: enqueued,
        lastSkipped: skipped,
        lastErrorSafe: sanitizeLogText((error as Error)?.message ?? "reconcile_failed", 200)
      };
      return this.status;
    } finally {
      this.running = false;
    }
  }
}