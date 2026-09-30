import {
  isBenignRefreshRotationReplay,
  isRefreshRotationInProgress
} from "../src/modules/auth/auth-refresh-replay";

describe("refresh rotation replay", () => {
  const now = new Date("2026-09-30T03:24:00.000Z");
  const familyId = "family-1";
  const liveSuccessor = {
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 60_000),
    familyId
  };

  it("accepts two near-simultaneous refreshes while the successor is still live", () => {
    expect(
      isBenignRefreshRotationReplay({
        revokedAt: new Date(now.getTime() - 2_000),
        replacedByTokenHash: "successor-hash",
        familyId,
        successor: liveSuccessor,
        now
      })
    ).toBe(true);
  });

  it("accepts a normal rotation that is still inside the concurrency window", () => {
    expect(isRefreshRotationInProgress(new Date(now.getTime() - 500), null, now)).toBe(true);
  });

  it("rejects a replay after the concurrency window so the family can be revoked", () => {
    expect(
      isBenignRefreshRotationReplay({
        revokedAt: new Date(now.getTime() - 60_000),
        replacedByTokenHash: "successor-hash",
        familyId,
        successor: liveSuccessor,
        now
      })
    ).toBe(false);
    expect(isRefreshRotationInProgress(new Date(now.getTime() - 60_000), null, now)).toBe(false);
  });

  it("rejects a replay when the replacement has already been revoked", () => {
    expect(
      isBenignRefreshRotationReplay({
        revokedAt: new Date(now.getTime() - 1_000),
        replacedByTokenHash: "successor-hash",
        familyId,
        successor: {
          revokedAt: now,
          expiresAt: new Date(now.getTime() + 60_000),
          familyId
        },
        now
      })
    ).toBe(false);
  });
});
