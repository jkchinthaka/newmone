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
});
