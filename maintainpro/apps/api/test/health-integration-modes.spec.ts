import { HealthService } from "../src/health.service";

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
      backupRequiredForStrictMode: false,
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

const healthyQueue = {
  mode: "active" as const,
  redis: { status: "active" as const, lastErrorAt: null, lastErrorMessageSafe: null },
  queues: {},
  totals: { waitingJobs: 0, activeJobs: 0, delayedJobs: 0, failedJobs: 0 }
};

function minimalHealth(queue: { getRedisAndQueueHealth: () => Promise<unknown> }, redisRequired: boolean) {
  return new HealthService(
    buildPrisma(),
    buildReplicationSync(),
    buildConfigService({
      HEALTHCHECK_DEPENDENCY_TIMEOUT_MS: 40,
      REDIS_REQUIRED_FOR_READINESS: redisRequired
    }),
    queue as any
  );
}

function expectNoSecrets(body: unknown) {
  expect(JSON.stringify(body)).not.toMatch(/password|secret|sqlserver:\/\/|mongodb:\/\//i);
}

describe("HealthService integration modes visibility", () => {
  it("shows disabled email/sms and mock push explicitly", async () => {
    const queueHealthService = {
      getRedisAndQueueHealth: jest.fn().mockResolvedValue({
        mode: "disabled",
        redis: {
          status: "disabled",
          lastErrorAt: null,
          lastErrorMessageSafe: null
        },
        queues: {},
        totals: { waitingJobs: 0, activeJobs: 0, delayedJobs: 0, failedJobs: 0 }
      })
    } as any;

    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        NODE_ENV: "development",
        DATABASE_URL: "mongodb://localhost:27017/app",
        EMAIL_MODE: "disabled",
        SMS_MODE: "disabled",
        PUSH_MODE: "mock",
        ERP_MODE: "disabled",
        BILLING_MODE: "disabled",
        STORAGE_MODE: "local"
      }),
      queueHealthService
    );

    const readiness = await health.getReadiness();

    const email = readiness.configuration.find((item) => item.key === "email");
    const sms = readiness.configuration.find((item) => item.key === "sms");
    const push = readiness.configuration.find((item) => item.key === "push");

    expect(email?.status).toBe("disabled");
    expect(sms?.status).toBe("disabled");
    expect(push?.status).toBe("mock");
  });

  it("returns ready when queue health resolves and the database is up", async () => {
    const health = minimalHealth(
      { getRedisAndQueueHealth: () => Promise.resolve(healthyQueue) },
      false
    );
    const started = Date.now();
    const result = await health.getMinimalReadiness();

    expect(Date.now() - started).toBeLessThan(500);
    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(Object.keys(result.body).sort()).toEqual(["build", "service", "status", "timestamp"]);
    expectNoSecrets(result.body);
  });

  it("stays ready when optional queue health rejects", async () => {
    const health = minimalHealth(
      { getRedisAndQueueHealth: () => Promise.reject(new Error("redis down")) },
      false
    );
    const result = await health.getMinimalReadiness();

    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ready");
    expectNoSecrets(result.body);
  });

  it("reports not ready when required queue health rejects", async () => {
    const health = minimalHealth(
      { getRedisAndQueueHealth: () => Promise.reject(new Error("redis://secret-host")) },
      true
    );
    const result = await health.getMinimalReadiness();

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("not_ready");
    expectNoSecrets(result.body);
  });

  it("reports not ready when the required database check fails", async () => {
    const prisma = buildPrisma();
    prisma.checkPrimary.mockRejectedValue(new Error("password=hidden"));
    const health = new HealthService(
      prisma,
      buildReplicationSync(),
      buildConfigService({ HEALTHCHECK_DEPENDENCY_TIMEOUT_MS: 40, REDIS_REQUIRED_FOR_READINESS: false }),
      { getRedisAndQueueHealth: () => Promise.resolve(healthyQueue) } as any
    );
    const result = await health.getMinimalReadiness();

    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("not_ready");
    expectNoSecrets(result.body);
  });

  it("returns minimal readiness when optional queue health never resolves", async () => {
    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        HEALTHCHECK_DEPENDENCY_TIMEOUT_MS: 30,
        REDIS_REQUIRED_FOR_READINESS: false
      }),
      { getRedisAndQueueHealth: () => new Promise(() => undefined) } as any
    );

    const started = Date.now();
    const result = await health.getMinimalReadiness();

    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(JSON.stringify(result.body)).not.toMatch(/password|sqlserver:\/\//i);
  });

  it("reports not ready when required queue health never resolves", async () => {
    const health = new HealthService(
      buildPrisma(),
      buildReplicationSync(),
      buildConfigService({
        HEALTHCHECK_DEPENDENCY_TIMEOUT_MS: 30,
        REDIS_REQUIRED_FOR_READINESS: true
      }),
      { getRedisAndQueueHealth: () => new Promise(() => undefined) } as any
    );

    const started = Date.now();
    const result = await health.getMinimalReadiness();

    expect(Date.now() - started).toBeLessThan(500);
    expect(result.httpStatus).toBe(503);
    expect(result.body.status).toBe("not_ready");
    expectNoSecrets(result.body);
  });
});
