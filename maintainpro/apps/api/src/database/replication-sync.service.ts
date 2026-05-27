import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from "@nestjs/common";
import { ReplicationOutbox, ReplicationOutboxStatus } from "@prisma/client";

import { sanitizeReplicationError } from "./replication.config";
import { PrismaService } from "./prisma.service";
import { applyReplicationEventToBackup } from "./replication.utils";

export interface ReplicationStatusSnapshot {
  enabled: boolean;
  configured: boolean;
  mode: string;
  primaryDatabaseName: string;
  backupDatabaseName: string;
  backupStatus: "operational" | "degraded" | "unconfigured";
  strictModeActive: boolean;
  pendingEvents: number;
  processingEvents: number;
  failedEvents: number;
  deadLetterEvents: number;
  lastSuccessfulSync: string | null;
  replicationLagMs: number;
  message: string;
}

export interface ReplicationProcessResult {
  claimed: number;
  synced: number;
  failed: number;
  deadLetter: number;
}

@Injectable()
export class ReplicationSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReplicationSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    const config = this.prisma.getReplicationConfig();
    if (!config.enabled || config.mode === "disabled") {
      return;
    }

    const intervalMs = Math.max(1_000, Math.min(config.retryDelayMs, 30_000));
    this.timer = setInterval(() => {
      this.processPendingBatch().catch((error) => {
        this.logger.warn(`Replication batch failed: ${sanitizeReplicationError(error)}`);
      });
    }, intervalMs);

    this.processPendingBatch().catch((error) => {
      this.logger.warn(`Initial replication batch failed: ${sanitizeReplicationError(error)}`);
    });
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPendingBatch(limit?: number): Promise<ReplicationProcessResult> {
    const config = this.prisma.getReplicationConfig();
    const empty: ReplicationProcessResult = { claimed: 0, synced: 0, failed: 0, deadLetter: 0 };

    if (!config.enabled || config.mode === "disabled") {
      return empty;
    }

    if (this.running) {
      return empty;
    }

    this.running = true;

    try {
      const now = new Date();
      const staleProcessingBefore = new Date(now.getTime() - Math.max(config.retryDelayMs, 5_000));
      const events = await this.prisma.replicationOutbox.findMany({
        where: {
          OR: [
            {
              status: {
                in: [ReplicationOutboxStatus.PENDING, ReplicationOutboxStatus.FAILED]
              },
              nextRetryAt: {
                lte: now
              }
            },
            {
              status: ReplicationOutboxStatus.PROCESSING,
              updatedAt: {
                lt: staleProcessingBefore
              }
            }
          ]
        },
        orderBy: {
          createdAt: "asc"
        },
        take: limit ?? config.batchSize
      });

      const result: ReplicationProcessResult = { ...empty };

      for (const event of events) {
        const claimed = await this.claimEvent(event);
        if (!claimed) continue;

        result.claimed += 1;

        try {
          const backup = this.prisma.getBackup();
          if (!backup) {
            throw new Error("Backup database is not configured.");
          }

          await applyReplicationEventToBackup(backup, event);
          await this.markSynced(event.id);
          result.synced += 1;
        } catch (error) {
          const deadLetter = await this.markFailed(event, error);
          if (deadLetter) {
            result.deadLetter += 1;
          } else {
            result.failed += 1;
          }
        }
      }

      return result;
    } finally {
      this.running = false;
    }
  }

  async getStatusSnapshot(): Promise<ReplicationStatusSnapshot> {
    const config = this.prisma.getReplicationConfig();
    const configured = Boolean(config.backupDatabaseUrl);
    const enabled = config.enabled && config.mode !== "disabled";

    if (!enabled) {
      return {
        enabled: false,
        configured,
        mode: config.mode,
        primaryDatabaseName: config.primaryDatabaseName,
        backupDatabaseName: config.backupDatabaseName,
        backupStatus: configured ? "operational" : "unconfigured",
        strictModeActive: false,
        pendingEvents: 0,
        processingEvents: 0,
        failedEvents: 0,
        deadLetterEvents: 0,
        lastSuccessfulSync: null,
        replicationLagMs: 0,
        message: "Database replication is disabled."
      };
    }

    const [pendingEvents, processingEvents, failedEvents, deadLetterEvents, lastSynced, oldestOpen] =
      await Promise.all([
        this.prisma.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.PENDING } }),
        this.prisma.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.PROCESSING } }),
        this.prisma.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.FAILED } }),
        this.prisma.replicationOutbox.count({ where: { status: ReplicationOutboxStatus.DEAD_LETTER } }),
        this.prisma.replicationOutbox.findFirst({
          where: { status: ReplicationOutboxStatus.SYNCED, syncedAt: { not: null } },
          orderBy: { syncedAt: "desc" },
          select: { syncedAt: true }
        }),
        this.prisma.replicationOutbox.findFirst({
          where: {
            status: {
              in: [
                ReplicationOutboxStatus.PENDING,
                ReplicationOutboxStatus.PROCESSING,
                ReplicationOutboxStatus.FAILED
              ]
            }
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true }
        })
      ]);

    let backupStatus: ReplicationStatusSnapshot["backupStatus"] = configured ? "operational" : "unconfigured";
    let message = configured
      ? "Backup database is configured for replication."
      : "Backup database URL is not configured.";

    if (configured) {
      try {
        await this.prisma.checkBackup();
      } catch (error) {
        backupStatus = "degraded";
        message = sanitizeReplicationError(error);
      }
    }

    if (deadLetterEvents > 0 || failedEvents > 0) {
      backupStatus = "degraded";
      message = `${failedEvents} failed and ${deadLetterEvents} dead-letter replication event(s) need attention.`;
    }

    return {
      enabled,
      configured,
      mode: config.mode,
      primaryDatabaseName: config.primaryDatabaseName,
      backupDatabaseName: config.backupDatabaseName,
      backupStatus,
      strictModeActive: config.mode === "strict_dual_write",
      pendingEvents,
      processingEvents,
      failedEvents,
      deadLetterEvents,
      lastSuccessfulSync: lastSynced?.syncedAt?.toISOString() ?? null,
      replicationLagMs: oldestOpen ? Math.max(0, Date.now() - oldestOpen.createdAt.getTime()) : 0,
      message
    };
  }

  private async claimEvent(event: ReplicationOutbox): Promise<boolean> {
    const claimed = await this.prisma.replicationOutbox.updateMany({
      where: {
        id: event.id,
        status: {
          in: [
            ReplicationOutboxStatus.PENDING,
            ReplicationOutboxStatus.FAILED,
            ReplicationOutboxStatus.PROCESSING
          ]
        }
      },
      data: {
        status: ReplicationOutboxStatus.PROCESSING,
        lastError: null
      }
    });

    return claimed.count === 1;
  }

  private async markSynced(id: string): Promise<void> {
    await this.prisma.replicationOutbox.update({
      where: { id },
      data: {
        status: ReplicationOutboxStatus.SYNCED,
        syncedAt: new Date(),
        attemptCount: { increment: 1 },
        lastError: null
      }
    });
  }

  private async markFailed(event: ReplicationOutbox, error: unknown): Promise<boolean> {
    const config = this.prisma.getReplicationConfig();
    const nextAttempt = event.attemptCount + 1;
    const deadLetter = nextAttempt >= config.retryAttempts;

    await this.prisma.replicationOutbox.update({
      where: { id: event.id },
      data: {
        status: deadLetter ? ReplicationOutboxStatus.DEAD_LETTER : ReplicationOutboxStatus.FAILED,
        attemptCount: nextAttempt,
        lastError: sanitizeReplicationError(error),
        nextRetryAt: new Date(Date.now() + config.retryDelayMs)
      }
    });

    return deadLetter;
  }
}