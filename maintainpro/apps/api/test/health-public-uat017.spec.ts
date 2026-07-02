import { HealthService } from "../src/health.service";

const buildConfigService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as any;

describe("HealthService public health (UAT-017)", () => {
  it("returns healthy database status when primary MongoDB is reachable", async () => {
    const health = new HealthService(
      {
        checkPrimary: jest.fn().mockResolvedValue(undefined),
        getReplicationConfig: jest.fn().mockReturnValue({
          primaryDatabaseName: "maintainpro_staging"
        })
      } as any,
      {} as any,
      buildConfigService({ NODE_ENV: "production" })
    );

    const payload = await health.getPublicHealth();

    expect(payload.status).toBe("healthy");
    expect(payload.database.status).toBe("healthy");
    expect(payload.database.message).toBe("Database connected");
    expect(typeof payload.database.latencyMs).toBe("number");
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it("returns unavailable database status without exposing connection secrets", async () => {
    const health = new HealthService(
      {
        checkPrimary: jest.fn().mockRejectedValue(new Error("Server selection timed out after 5000 ms")),
        getReplicationConfig: jest.fn().mockReturnValue({
          primaryDatabaseName: "maintainpro_staging"
        })
      } as any,
      {} as any,
      buildConfigService({ NODE_ENV: "production" })
    );

    const payload = await health.getPublicHealth();

    expect(payload.status).toBe("unavailable");
    expect(payload.database.status).toBe("unavailable");
    expect(payload.database.message).toBe("Database unavailable");
    expect(JSON.stringify(payload)).not.toMatch(/mongodb(\+srv)?:\/\//i);
  });
});
