import { isBenignRefreshRotationReplay } from "../src/modules/auth/auth-refresh-replay";

describe("refresh rotation replay", () => {
  const now = new Date("2026-09-30T03:24:00.000Z");
  const familyId = "family-1";

  it("accepts a replay a few seconds after rotation when the successor is still live", () => {
    expect(
      isBenignRefreshRotationReplay({
        revokedAt: new Date(now.getTime() - 2_000),
        replacedByTokenHash: "successor-hash",
        familyId,
        successor: {
          revokedAt: null,
          expiresAt: new Date(now.getTime() + 60_000),
          familyId
        },
        now
      })
    ).toBe(true);
  });

  it("rejects a replay after the grace window so the family can be revoked", () => {
    expect(
      isBenignRefreshRotationReplay({
        revokedAt: new Date(now.getTime() - 60_000),
        replacedByTokenHash: "successor-hash",
        familyId,
        successor: {
          revokedAt: null,
          expiresAt: new Date(now.getTime() + 60_000),
          familyId
        },
        now
      })
    ).toBe(false);
  });

  it("rejects a replay when the successor was already revoked", () => {
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
