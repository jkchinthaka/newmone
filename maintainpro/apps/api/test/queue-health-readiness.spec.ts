import { HealthService } from "../src/health.service";

type QueueHealthStub = {
  getRedisAndQueueHealth: jest.Mock;
};

const buildConfigService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as any;

const buildPrisma = () =>
  ({
    checkPrimary: jest.fn().mockResolvedValue(undefined),
    getReplicationConfig: jest.fn().mockReturnValue({
      enabled: false,
      mode: "disabled",
      backupDatabaseUrl: "",
      backupRequiredForReadiness: false,
      backupRequiredForStrictMode: true,
      primaryDatabaseName: "primary",
      backupDatabaseName: "backup"
    })
  }) as any;

const buildReplicationSync = () =>
  ({
    getStatusSnapshot: jest.fn().mockResolvedValue({
      enabled: false,
      configured: false,
      mode: "disabled",
      primaryDatabaseName: "primary",
      backupDatabaseName: "backup",
      backupStatus: "disabled",
      strictModeActive: false,
      pendingEvents: 0,
      processingEvents: 0,
      failedEvents: 0,
      deadLetterEvents: 0,
      lastSuccessfulSync: null,
      replicationLagMs: 0,
      message: "Backup replication disabled"
    })
  }) as any;

describe("HealthService queue readiness", () => {
  it("returns disabled queue health when Redis is intentionally disabled", async () => {
    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        NODE_ENV: "test",
        REDIS_URL: "",
        REDIS_REQUIRED_FOR_READINESS: false
      })
    );

    const readiness = await health.getReadiness();

    expect(readiness.queues.redis.status).toBe("disabled");
    expect(readiness.queues.redis.lastErrorMessageSafe).toBeNull();
  });

  it("returns failed queue health when Redis/queue monitor reports failure", async () => {
    const queueHealthService: QueueHealthStub = {
      getRedisAndQueueHealth: jest.fn().mockResolvedValue({
        mode: "failed",
        redis: {
          status: "failed",
          lastErrorAt: "2026-06-12T12:00:00.000Z",
          lastErrorMessageSafe: "Redis connection refused"
        },
        queues: {
          notification: {
            status: "failed",
            lastErrorAt: "2026-06-12T12:00:00.000Z",
            lastErrorMessageSafe: "Queue worker unavailable",
            waitingJobs: 4,
            activeJobs: 0,
            delayedJobs: 1,
            failedJobs: 6
          }
        },
        totals: {
          waitingJobs: 4,
          activeJobs: 0,
          delayedJobs: 1,
          failedJobs: 6
        }
      })
    };

    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        REDIS_REQUIRED_FOR_READINESS: true
      }),
      queueHealthService as any
    );

    const readiness = await health.getReadiness();
    const redisCheck = readiness.dependencies.find((dependency) => dependency.key === "redis");
    const notificationQueueCheck = readiness.dependencies.find(
      (dependency) => dependency.key === "queue.notification"
    );

    expect(redisCheck?.status).toBe("failed");
    expect(notificationQueueCheck?.status).toBe("failed");
    expect(readiness.queues.queues.notification.failedJobs).toBe(6);
    expect(readiness.summary.failed).toBeGreaterThan(0);
  });

  it("does not expose redis urls or secrets in readiness output", async () => {
    const queueHealthService: QueueHealthStub = {
      getRedisAndQueueHealth: jest.fn().mockResolvedValue({
        mode: "degraded",
        redis: {
          status: "degraded",
          lastErrorAt: "2026-06-12T12:00:00.000Z",
          lastErrorMessageSafe: "Redis reconnecting"
        },
        queues: {},
        totals: {
          waitingJobs: 0,
          activeJobs: 0,
          delayedJobs: 0,
          failedJobs: 0
        }
      })
    };

    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        NODE_ENV: "test",
        REDIS_URL: "redis://user:password@localhost:6379"
      }),
      queueHealthService as any
    );

    const readiness = await health.getReadiness();
    const serialized = JSON.stringify(readiness);

    expect(serialized).not.toContain("redis://");
    expect(serialized).not.toContain("password@");
  });

  it("keeps public health minimal without queue internals", async () => {
    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        NODE_ENV: "test"
      })
    );

    const publicHealth = await health.getPublicHealth();

    expect(publicHealth).not.toHaveProperty("queues");
    expect(publicHealth).not.toHaveProperty("dependencies");
    expect(publicHealth).toHaveProperty("database");
  });
});
