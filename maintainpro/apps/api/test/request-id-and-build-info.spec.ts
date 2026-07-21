import { BadRequestException } from "@nestjs/common";

import { normalizeIncomingRequestId, resolveRequestId } from "../src/common/middleware/request-id.middleware";
import { resolveSafeBuildInfo } from "../src/common/utils/build-info.util";

describe("request id middleware helpers", () => {
  it("accepts safe inbound request ids", () => {
    expect(normalizeIncomingRequestId("abc-123_DEF.9")).toBe("abc-123_DEF.9");
  });

  it("rejects oversized or unsafe inbound ids", () => {
    expect(normalizeIncomingRequestId("bad id")).toBeNull();
    expect(normalizeIncomingRequestId("x".repeat(200))).toBeNull();
  });

  it("generates a uuid when inbound id is missing", () => {
    const id = resolveRequestId(undefined);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("safe build info", () => {
  it("prefers APP_COMMIT_SHA and never exposes secrets", () => {
    const info = resolveSafeBuildInfo("maintainpro-api", (key, fallback = "") => {
      const map: Record<string, string> = {
        APP_COMMIT_SHA: "abc123",
        APP_BUILD_TIMESTAMP: "2026-07-21T00:00:00.000Z",
        APP_ENVIRONMENT: "staging",
        APP_VERSION: "1.2.0",
        DATABASE_URL: "secret-should-not-appear"
      };
      return map[key] ?? fallback;
    });

    expect(info).toEqual({
      service: "maintainpro-api",
      commitSha: "abc123",
      buildTimestamp: "2026-07-21T00:00:00.000Z",
      environment: "staging",
      version: "1.2.0"
    });
    expect(JSON.stringify(info)).not.toContain("secret");
  });
});