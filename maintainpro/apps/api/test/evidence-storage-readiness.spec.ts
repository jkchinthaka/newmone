import { EvidenceStorageProviderService } from "../src/modules/evidence/evidence-storage-provider.service";
import { publicEvidenceReadinessHasSensitiveFields } from "../src/modules/evidence/evidence-storage.mapper";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("evidence storage readiness", () => {
  it("reports disabled when uploads flag is false", () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: false
      })
    );

    expect(provider.checkReadiness()).toMatchObject({
      state: "disabled",
      indicator: "DISABLED",
      uploadsEnabled: false
    });
  });

  it("reports not_configured for minio without credentials", () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        STORAGE_MODE: "minio",
        STORAGE_UPLOADS_ENABLED: true
      })
    );

    const readiness = provider.checkReadiness();
    expect(readiness.state).toBe("not_configured");
    expect(readiness.missingKeys.length).toBeGreaterThan(0);
  });

  it("enables mock readiness outside production", () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        NODE_ENV: "development",
        STORAGE_MODE: "mock",
        STORAGE_UPLOADS_ENABLED: true
      })
    );

    expect(provider.checkReadiness()).toMatchObject({
      mode: "mock",
      state: "configured",
      indicator: "ENABLED",
      uploadsEnabled: true
    });
  });

  it("does not expose secrets in readiness payloads", () => {
    const provider = new EvidenceStorageProviderService(
      configService({
        STORAGE_MODE: "cloudinary",
        STORAGE_UPLOADS_ENABLED: true,
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret-value"
      })
    );

    const readiness = provider.checkReadiness();
    expect(publicEvidenceReadinessHasSensitiveFields(readiness)).toBe(false);
    expect(JSON.stringify(readiness)).not.toContain("secret-value");
  });
});
