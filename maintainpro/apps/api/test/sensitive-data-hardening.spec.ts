import {
  containsUnredactedSecrets,
  redactSensitiveData,
  REDACTED_PLACEHOLDER
} from "../src/common/utils/sensitive-data-redaction.util";
import { FORBIDDEN_USER_RESPONSE_KEYS } from "../src/common/selects/public-user.select";
import {
  getReplicationClass,
  ReplicationClass,
  shouldEnqueueReplication
} from "../src/database/replication-classification";
import { sanitizeRecordForModel } from "../src/database/replication.utils";

describe("sensitive data redaction", () => {
  it("redacts nested passwordHash and token fields case-insensitively", () => {
    const input = {
      user: {
        id: "u1",
        PasswordHash: "$2a$10$secret",
        profile: { refreshToken: "rt", nested: [{ apiSecret: "x" }] }
      },
      smtpPass: "mail-secret"
    };

    const redacted = redactSensitiveData(input);
    expect(redacted.user.PasswordHash).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.profile.refreshToken).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.profile.nested[0].apiSecret).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.smtpPass).toBe(REDACTED_PLACEHOLDER);
    expect(redacted.user.id).toBe("u1");
  });

  it("preserves allowlisted non-secret status fields", () => {
    const input = { mustChangePassword: true, passwordHash: "hash" };
    const redacted = redactSensitiveData(input);
    expect(redacted.mustChangePassword).toBe(true);
    expect(redacted.passwordHash).toBe(REDACTED_PLACEHOLDER);
  });

  it("detects unredacted secrets in representative API payloads", () => {
    const leaky = {
      data: {
        drivers: [{ user: { id: "1", passwordHash: "should-not-leak" } }]
      }
    };
    const check = containsUnredactedSecrets(leaky, {
      forbiddenExactKeys: [...FORBIDDEN_USER_RESPONSE_KEYS]
    });
    expect(check.found).toBe(true);
    expect(check.paths.some((p) => p.includes("passwordHash"))).toBe(true);

    const safe = redactSensitiveData(leaky);
    const safeCheck = containsUnredactedSecrets(safe, {
      forbiddenExactKeys: [...FORBIDDEN_USER_RESPONSE_KEYS]
    });
    expect(safeCheck.found).toBe(false);
  });

  it("covers auth lifecycle audit-shaped snapshots", () => {
    const scenarios = [
      {
        name: "user creation",
        before: null,
        after: { email: "a@b.com", passwordHash: "hash", temporaryPassword: "tmp" }
      },
      {
        name: "password reset",
        before: { tokenHash: "old" },
        after: { tokenHash: "new", resetToken: "raw" }
      },
      {
        name: "password change",
        before: { passwordHash: "old" },
        after: { passwordHash: "new", lastPasswordChangedAt: new Date().toISOString() }
      },
      {
        name: "invitation acceptance",
        before: { status: "PENDING" },
        after: { status: "ACCEPTED", tokenHash: "invite-hash" }
      },
      {
        name: "provider configuration",
        before: { key: "smtp", value: { smtpPass: "old" } },
        after: { key: "smtp", value: { smtpPass: "new", apiKey: "k" } }
      }
    ];

    for (const scenario of scenarios) {
      const snapshot = redactSensitiveData({
        before: scenario.before,
        after: scenario.after
      });
      const check = containsUnredactedSecrets(snapshot, {
        forbiddenExactKeys: [...FORBIDDEN_USER_RESPONSE_KEYS, "secret"]
      });
      expect(check.found).toBe(false);
    }
  });
});

describe("replication data classification", () => {
  it("never replicates refresh and password-reset tokens", () => {
    expect(getReplicationClass("RefreshToken")).toBe(ReplicationClass.NEVER_REPLICATE);
    expect(getReplicationClass("PasswordResetToken")).toBe(ReplicationClass.NEVER_REPLICATE);
    expect(shouldEnqueueReplication("RefreshToken")).toBe(false);
  });

  it("strips passwordHash from User outbox payloads", () => {
    const payload = sanitizeRecordForModel("User", {
      id: "507f1f77bcf86cd799439011",
      email: "ops@example.com",
      passwordHash: "$2a$10$should-not-replicate",
      firstName: "Ops",
      lastName: "User",
      roleId: "507f1f77bcf86cd799439012",
      isActive: true,
      failedLoginAttempts: 3,
      lockedUntil: new Date().toISOString()
    });

    expect(payload).not.toBeNull();
    expect(payload?.passwordHash).toBeUndefined();
    expect(payload?.failedLoginAttempts).toBeUndefined();
    expect(payload?.email).toBe("ops@example.com");

    const check = containsUnredactedSecrets(payload, {
      forbiddenExactKeys: [...FORBIDDEN_USER_RESPONSE_KEYS]
    });
    expect(check.found).toBe(false);
  });

  it("metadata-only invitations omit token hashes", () => {
    const payload = sanitizeRecordForModel("UserInvitation", {
      id: "507f1f77bcf86cd799439013",
      tenantId: "507f1f77bcf86cd799439014",
      userId: "507f1f77bcf86cd799439015",
      invitedById: "507f1f77bcf86cd799439016",
      tokenHash: "secret-hash",
      status: "PENDING",
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(payload?.tokenHash).toBeUndefined();
    expect(payload?.userId).toBe("507f1f77bcf86cd799439015");
  });
});

describe("public user select contract", () => {
  it("does not include forbidden credential fields", () => {
    const { PUBLIC_USER_SELECT, PUBLIC_USER_WITH_ROLE_SELECT, PUBLIC_USER_SUMMARY_SELECT } =
      require("../src/common/selects/public-user.select") as typeof import("../src/common/selects/public-user.select");

    for (const select of [PUBLIC_USER_SELECT, PUBLIC_USER_WITH_ROLE_SELECT, PUBLIC_USER_SUMMARY_SELECT]) {
      for (const key of FORBIDDEN_USER_RESPONSE_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(select, key)).toBe(false);
      }
    }
  });
});
