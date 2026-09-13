import { ServiceUnavailableException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";

import {
  createFgSessionStore,
  FG_SESSION_REDIS_REQUIRED_MSG,
  MemoryFgSessionStore,
  RedisFgSessionStore
} from "../src/modules/mobile-fg/fg-session-store";
import type { FgBrokerSession } from "../src/modules/mobile-fg/fg-session.types";

const sampleSession = (overrides: Partial<FgBrokerSession> = {}): FgBrokerSession => ({
  tenantId: "t1",
  userId: "u1",
  accessTokenFingerprint: "fp",
  sessionCookieName: "sessionid",
  sessionCookieValue: "cookie-value",
  csrfCookieName: "csrftoken",
  csrfCookieValue: "csrf-value",
  csrfToken: "token",
  expiresAtMs: Date.now() + 60_000,
  createdAtMs: Date.now(),
  refreshedAtMs: Date.now(),
  ...overrides
});

describe("mobile-fg broker invariants", () => {
  it("createFgSessionStore fail-closed when production and redisUrl empty", () => {
    expect(() =>
      createFgSessionStore({ isProduction: true, redisUrl: "" })
    ).toThrow(FG_SESSION_REDIS_REQUIRED_MSG);

    expect(() =>
      createFgSessionStore({ isProduction: true, redisUrl: "   " })
    ).toThrow(FG_SESSION_REDIS_REQUIRED_MSG);
  });

  it("allows MemoryFgSessionStore when not production and no redis", async () => {
    const store = createFgSessionStore({ isProduction: false, redisUrl: "" });
    expect(store).toBeInstanceOf(MemoryFgSessionStore);

    const session = sampleSession();
    await store.set("k1", session, 60);
    await expect(store.get("k1")).resolves.toEqual(session);
  });

  it("RedisFgSessionStore in production never falls back to memory on redis failure", async () => {
    const store = new RedisFgSessionStore("redis://127.0.0.1:1", 60, true);
    const redis = (store as unknown as { redis: { connect: jest.Mock; status: string; get: jest.Mock } })
      .redis;

    // Force ensureConnected connect path to fail.
    Object.defineProperty(redis, "status", { get: () => "wait", configurable: true });
    redis.connect = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(store.get("any")).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(store.get("any")).rejects.toThrow(/FG session Redis unavailable in production/);

    // Seed memory fallback privately — production get must not return it.
    const fallback = (store as unknown as { fallback: MemoryFgSessionStore }).fallback;
    await fallback.set("secret", sampleSession({ userId: "leaked" }), 60);

    Object.defineProperty(redis, "status", { get: () => "ready", configurable: true });
    redis.get = jest.fn().mockRejectedValue(new Error("READONLY"));

    await expect(store.get("secret")).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(fallback.get("secret")).resolves.toMatchObject({ userId: "leaked" });
  });

  it("mobile-fg.service source does not log raw tokens or cookies", () => {
    const servicePath = join(__dirname, "../src/modules/mobile-fg/mobile-fg.service.ts");
    const source = readFileSync(servicePath, "utf8");

    expect(source).not.toMatch(/logger\.(log|warn|debug|error|verbose)\([^)]*token/i);
    expect(source).not.toMatch(/logger\.(log|warn|debug|error|verbose)\([^)]*cookie/i);
    expect(source).not.toMatch(/console\.(log|warn|debug|error)\([^)]*(token|cookie|authorization)/i);
    expect(source).toContain("Never include cookies, csrf, assertion, or Authorization");
  });
});
