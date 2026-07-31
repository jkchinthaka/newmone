import {
  assessReleaseMetadata,
  isForbiddenProductionCommitSha,
  resolveSafeBuildInfo
} from "../src/common/utils/build-info.util";

describe("release metadata (DEPLOY-REL build identity)", () => {
  it("prefers APP_* fields and APP_SERVICE_NAME", () => {
    const info = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") => {
      const map: Record<string, string> = {
        APP_SERVICE_NAME: "maintainpro-api",
        APP_COMMIT_SHA: "d400de4aea65e0ad8379616b983b0e91713cfca9",
        APP_BUILD_TIMESTAMP: "2026-08-01T00:00:00.000Z",
        APP_ENVIRONMENT: "production",
        APP_VERSION: "1.2.1",
        DATABASE_URL: "secret-should-not-appear"
      };
      return map[key] ?? fallback;
    });

    expect(info.commitSha).toBe("d400de4aea65e0ad8379616b983b0e91713cfca9");
    expect(info.service).toBe("maintainpro-api");
    expect(JSON.stringify(info)).not.toContain("secret");
  });

  it("rejects forbidden production sentinels", () => {
    expect(isForbiddenProductionCommitSha("unknown")).toBe(true);
    expect(isForbiddenProductionCommitSha("latest")).toBe(true);
    expect(isForbiddenProductionCommitSha("local-production")).toBe(true);
    expect(isForbiddenProductionCommitSha("d400de4aea65e0ad8379616b983b0e91713cfca9")).toBe(false);
  });

  it("blocks production when commit or timestamp is missing/sentinel", () => {
    const info = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") => {
      const map: Record<string, string> = {
        APP_COMMIT_SHA: "unknown",
        APP_ENVIRONMENT: "production",
        NODE_ENV: "production",
        APP_VERSION: "1.2.1"
      };
      return map[key] ?? fallback;
    });
    const assessment = assessReleaseMetadata(info, { nodeEnv: "production" });
    expect(assessment.acceptable).toBe(false);
    expect(assessment.issues.length).toBeGreaterThan(0);
  });

  it("allows explicit development fallback commit", () => {
    const info = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") => {
      const map: Record<string, string> = {
        NODE_ENV: "development",
        APP_ENVIRONMENT: "development"
      };
      return map[key] ?? fallback;
    });
    expect(info.commitSha).toBe("dev-unspecified");
    const assessment = assessReleaseMetadata(info, { nodeEnv: "development" });
    expect(assessment.acceptable).toBe(true);
    expect(assessment.warnings.length).toBeGreaterThan(0);
  });
});
