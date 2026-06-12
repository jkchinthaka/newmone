import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bull";
import type Redis from "ioredis";

export type QueueRuntimeStatus = "active" | "degraded" | "disabled" | "failed";

export interface QueueRuntimeSnapshot {
  status: QueueRuntimeStatus;
  lastErrorAt: string | null;
  lastErrorMessageSafe: string | null;
  waitingJobs: number;
  activeJobs: number;
  delayedJobs: number;
  failedJobs: number;
}

@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly states = new Map<string, QueueRuntimeSnapshot>();
  private readonly boundRedisClients = new WeakSet<Redis>();
  private readonly lastLogAt = new Map<string, number>();

  private redisStatus: QueueRuntimeStatus = "disabled";
  private redisLastErrorAt: string | null = null;
  private redisLastErrorMessageSafe: string | null = null;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    if (this.isRedisConfigured()) {
      this.redisStatus = "degraded";
    }
  }

  registerQueue(queueName: string, queue: Queue): void {
    this.queues.set(queueName, queue);
    if (!this.states.has(queueName)) {
      this.states.set(queueName, this.defaultSnapshot());
    }

    if (!this.isRedisConfigured()) {
      this.setQueueStatus(queueName, "disabled", null, "queue_disabled");
      this.redisStatus = "disabled";
      this.redisLastErrorAt = null;
      this.redisLastErrorMessageSafe = null;
      return;
    }

    this.setQueueStatus(queueName, "degraded", null, "queue_registered");

    queue.on("error", (error) => {
      this.setQueueStatus(queueName, "failed", error, "queue_error");
      this.setRedisStatus("failed", error, "redis_queue_error");
    });

    queue.on("stalled", () => {
      this.setQueueStatus(queueName, "degraded", "Queue job stalled", "queue_stalled");
    });

    queue.on("ready", () => {
      this.setQueueStatus(queueName, "active", null, "queue_ready");
      this.setRedisStatus("active", null, "redis_ready");
    });

    queue.on("resumed", () => {
      this.setQueueStatus(queueName, "active", null, "queue_resumed");
      this.setRedisStatus("active", null, "redis_resumed");
    });

    void this.bindRedisClient(queueName, queue);
  }

  markQueueProcessorFailure(queueName: string, error: unknown): void {
    this.setQueueStatus(queueName, "failed", error, "processor_failed");
  }

  isQueueOperational(queueName: string): boolean {
    if (!this.isRedisConfigured()) {
      return false;
    }
    const queue = this.states.get(queueName);
    if (!queue) {
      return false;
    }
    return queue.status === "active" || queue.status === "degraded";
  }

  async getRedisAndQueueHealth(): Promise<{
    mode: QueueRuntimeStatus;
    redis: {
      status: QueueRuntimeStatus;
      lastErrorAt: string | null;
      lastErrorMessageSafe: string | null;
    };
    queues: Record<string, QueueRuntimeSnapshot>;
    totals: {
      waitingJobs: number;
      activeJobs: number;
      delayedJobs: number;
      failedJobs: number;
    };
  }> {
    if (!this.isRedisConfigured()) {
      const disabledQueues = Object.fromEntries(
        Array.from(this.queues.keys()).map((key) => [
          key,
          {
            ...this.defaultSnapshot(),
            status: "disabled" as QueueRuntimeStatus
          }
        ])
      );
      return {
        mode: "disabled",
        redis: {
          status: "disabled",
          lastErrorAt: null,
          lastErrorMessageSafe: null
        },
        queues: disabledQueues,
        totals: {
          waitingJobs: 0,
          activeJobs: 0,
          delayedJobs: 0,
          failedJobs: 0
        }
      };
    }

    for (const [queueName, queue] of this.queues.entries()) {
      await this.refreshQueueCounts(queueName, queue);
    }

    const queueEntries = Array.from(this.states.entries());
    const queues = Object.fromEntries(queueEntries);

    const totals = queueEntries.reduce(
      (acc, [, value]) => ({
        waitingJobs: acc.waitingJobs + value.waitingJobs,
        activeJobs: acc.activeJobs + value.activeJobs,
        delayedJobs: acc.delayedJobs + value.delayedJobs,
        failedJobs: acc.failedJobs + value.failedJobs
      }),
      { waitingJobs: 0, activeJobs: 0, delayedJobs: 0, failedJobs: 0 }
    );

    return {
      mode: this.computeMode(),
      redis: {
        status: this.redisStatus,
        lastErrorAt: this.redisLastErrorAt,
        lastErrorMessageSafe: this.redisLastErrorMessageSafe
      },
      queues,
      totals
    };
  }

  captureBootstrapRedisError(origin: string, error: unknown): boolean {
    const safe = this.toSafeErrorMessage(error);
    if (!/ECONNREFUSED|Redis|ioredis|max retries|timed out|ENOTFOUND|EAI_AGAIN/i.test(safe)) {
      return false;
    }

    if (!this.isRedisConfigured()) {
      this.logStateChange("redis", this.redisStatus, "disabled", `${origin}_redis_disabled`, null);
      return true;
    }

    this.setRedisStatus("failed", safe, origin);
    return true;
  }

  private async bindRedisClient(queueName: string, queue: Queue): Promise<void> {
    try {
      const client = await queue.client;
      if (this.boundRedisClients.has(client)) {
        return;
      }
      this.boundRedisClients.add(client);

      client.on("ready", () => {
        this.setRedisStatus("active", null, "redis_ready");
        this.setQueueStatus(queueName, "active", null, "redis_ready");
      });
      client.on("connect", () => {
        this.setRedisStatus("active", null, "redis_connect");
      });
      client.on("reconnecting", () => {
        this.setRedisStatus("degraded", "Redis reconnecting", "redis_reconnecting");
      });
      client.on("close", () => {
        this.setRedisStatus("degraded", "Redis connection closed", "redis_close");
      });
      client.on("end", () => {
        this.setRedisStatus("failed", "Redis connection ended", "redis_end");
      });
      client.on("error", (error) => {
        this.setRedisStatus("failed", error, "redis_error");
        this.setQueueStatus(queueName, "failed", error, "redis_error");
      });

      this.setRedisStatus("active", null, "redis_bound");
      this.setQueueStatus(queueName, "active", null, "redis_bound");
    } catch (error) {
      this.setRedisStatus("failed", error, "redis_bind_failed");
      this.setQueueStatus(queueName, "failed", error, "redis_bind_failed");
    }
  }

  private async refreshQueueCounts(queueName: string, queue: Queue): Promise<void> {
    try {
      const counts = await queue.getJobCounts();
      const current = this.states.get(queueName) ?? this.defaultSnapshot();
      const nextStatus = current.status === "disabled" ? "disabled" : "active";
      this.states.set(queueName, {
        ...current,
        status: nextStatus,
        waitingJobs: counts.waiting ?? 0,
        activeJobs: counts.active ?? 0,
        delayedJobs: counts.delayed ?? 0,
        failedJobs: counts.failed ?? 0
      });
    } catch (error) {
      this.setQueueStatus(queueName, "failed", error, "queue_count_failed");
    }
  }

  private setQueueStatus(
    queueName: string,
    status: QueueRuntimeStatus,
    error: unknown,
    reason: string
  ): void {
    const previous = this.states.get(queueName) ?? this.defaultSnapshot();
    const safeError = error ? this.toSafeErrorMessage(error) : null;
    const next: QueueRuntimeSnapshot = {
      ...previous,
      status,
      lastErrorAt: safeError ? new Date().toISOString() : previous.lastErrorAt,
      lastErrorMessageSafe: safeError ?? previous.lastErrorMessageSafe
    };
    this.states.set(queueName, next);
    this.logStateChange(`queue:${queueName}`, previous.status, status, reason, safeError);
  }

  private setRedisStatus(status: QueueRuntimeStatus, error: unknown, reason: string): void {
    const previous = this.redisStatus;
    const safeError = error ? this.toSafeErrorMessage(error) : null;
    this.redisStatus = status;
    if (safeError) {
      this.redisLastErrorAt = new Date().toISOString();
      this.redisLastErrorMessageSafe = safeError;
    }
    this.logStateChange("redis", previous, status, reason, safeError);
  }

  private computeMode(): QueueRuntimeStatus {
    if (!this.isRedisConfigured()) {
      return "disabled";
    }
    if (this.redisStatus === "failed") {
      return "failed";
    }

    const statuses = Array.from(this.states.values()).map((value) => value.status);
    if (statuses.some((status) => status === "failed")) {
      return "failed";
    }
    if (statuses.some((status) => status === "degraded") || this.redisStatus === "degraded") {
      return "degraded";
    }
    if (statuses.every((status) => status === "disabled")) {
      return "disabled";
    }
    return "active";
  }

  private logStateChange(
    key: string,
    previous: QueueRuntimeStatus,
    next: QueueRuntimeStatus,
    reason: string,
    errorMessage?: string | null
  ): void {
    const now = Date.now();
    const lastAt = this.lastLogAt.get(key) ?? 0;
    const shouldLog = previous !== next || now - lastAt > 60_000;
    if (!shouldLog) {
      return;
    }
    this.lastLogAt.set(key, now);

    const prefix = `[queue-health] target=${key} status=${next} reason=${reason}`;
    if (next === "failed") {
      this.logger.error(errorMessage ? `${prefix} error="${errorMessage}"` : prefix);
      return;
    }
    if (next === "degraded") {
      this.logger.warn(errorMessage ? `${prefix} detail="${errorMessage}"` : prefix);
      return;
    }
    this.logger.log(prefix);
  }

  private defaultSnapshot(): QueueRuntimeSnapshot {
    return {
      status: this.isRedisConfigured() ? "degraded" : "disabled",
      lastErrorAt: null,
      lastErrorMessageSafe: null,
      waitingJobs: 0,
      activeJobs: 0,
      delayedJobs: 0,
      failedJobs: 0
    };
  }

  private isRedisConfigured(): boolean {
    return Boolean(this.configService.get<string>("REDIS_URL", "").trim());
  }

  private toSafeErrorMessage(error: unknown): string {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown queue/redis error";

    return raw
      .replace(/redis:\/\/[^@\s]+@/gi, "redis://***:***@")
      .replace(/(password|pass|pwd|token|secret)\s*[=:]\s*[^,\s]+/gi, "$1=***")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);
  }
}
