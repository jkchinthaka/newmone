import { DeploymentReadinessService } from "../src/deployment-readiness.service";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("DeploymentReadinessService", () => {
  it("does not fake readiness pass when required configs are missing in production", () => {
    const service = new DeploymentReadinessService(
      configService({
        NODE_ENV: "production",
        REDIS_REQUIRED_IN_PRODUCTION: true,
        REDIS_URL: "",
        JWT_SECRET: "",
        CORS_ORIGIN: "",
        FRONTEND_URL: ""
      })
    );

    const summary = service.getSummary({
      databaseStatus: "failed",
      redisStatus: "failed",
      emailState: "disabled",
      smsState: "disabled",
      erpState: "disabled",
      objectStorageStatus: "degraded"
    });

    expect(summary.overallStatus).toBe("blocked");
    expect(summary.blockers.length).toBeGreaterThan(0);
    expect(summary.checks.some((check) => check.key === "database" && check.status === "blocked")).toBe(
      true
    );
  });

  it("marks optional integrations as warnings instead of blockers", () => {
    const service = new DeploymentReadinessService(
      configService({
        NODE_ENV: "development",
        JWT_SECRET: "secret",
        CORS_ORIGIN: "http://localhost:3001",
        FRONTEND_URL: "http://localhost:3001"
      })
    );

    const summary = service.getSummary({
      databaseStatus: "operational",
      redisStatus: "disabled",
      emailState: "disabled",
      smsState: "disabled",
      erpState: "disabled",
      objectStorageStatus: "degraded"
    });

    expect(summary.overallStatus).toBe("warning");
    expect(summary.blockers).toHaveLength(0);
  });

  it("separates recoverable backup checks from replication", () => {
    const service = new DeploymentReadinessService(
      configService({
        NODE_ENV: "development",
        JWT_SECRET: "secret",
        CORS_ORIGIN: "http://localhost:3001",
        FRONTEND_URL: "http://localhost:3001",
        BACKUP_DATABASE_URL: "mongodb://example/backup",
        BACKUP_DATABASE_REQUIRED_FOR_READINESS: false,
        BACKUP_RESTORE_REQUIRED_FOR_READINESS: false,
        RECOVERY_BACKUP_POLICY_CONFIGURED: "true",
        RECOVERY_LAST_BACKUP_INTEGRITY_STATUS: "valid",
        RECOVERY_LAST_BACKUP_AGE_HOURS: "1",
        RECOVERY_LAST_RESTORE_TEST_STATUS: "success",
        RECOVERY_LAST_RESTORE_TEST_AGE_HOURS: "1",
        RECOVERY_EVIDENCE_SOURCE: "e2e"
      })
    );
    const summary = service.getSummary({
      databaseStatus: "operational",
      redisStatus: "operational",
      emailState: "disabled",
      smsState: "disabled",
      erpState: "disabled",
      objectStorageStatus: "operational"
    });
    expect(summary.checks.some((c) => c.key === "backupReplication")).toBe(true);
    expect(summary.checks.some((c) => c.key === "backupPolicyConfigured")).toBe(true);
    expect(summary.checks.some((c) => c.key === "lastRestoreTestStatus")).toBe(true);
  });

  it("rejects E2E recovery evidence for production restore readiness when required", () => {
    const service = new DeploymentReadinessService(
      configService({
        NODE_ENV: "production",
        JWT_SECRET: "secret",
        JWT_ACCESS_SECRET: "secret",
        CORS_ORIGIN: "https://example.com",
        FRONTEND_URL: "https://example.com",
        READINESS_API_KEY: "key",
        REDIS_REQUIRED_IN_PRODUCTION: false,
        BACKUP_RESTORE_REQUIRED_FOR_READINESS: true,
        RECOVERY_BACKUP_POLICY_CONFIGURED: "true",
        RECOVERY_LAST_BACKUP_INTEGRITY_STATUS: "valid",
        RECOVERY_LAST_RESTORE_TEST_STATUS: "success",
        RECOVERY_EVIDENCE_SOURCE: "e2e"
      })
    );
    const summary = service.getSummary({
      databaseStatus: "operational",
      redisStatus: "disabled",
      objectStorageStatus: "operational"
    });
    expect(
      summary.checks.some(
        (c) => c.key === "lastRestoreTestStatus" && c.status === "blocked"
      )
    ).toBe(true);
  });
});
