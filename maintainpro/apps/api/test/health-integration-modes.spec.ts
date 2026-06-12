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
});
