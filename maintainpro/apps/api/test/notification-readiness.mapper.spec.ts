import {
  mapEmailIndicator,
  mapPushIndicator,
  mapSmsIndicator,
  publicNotificationReadinessHasSensitiveFields
} from "../src/modules/notifications/notification-readiness.mapper";

describe("notification-readiness.mapper", () => {
  it("maps email indicators", () => {
    expect(mapEmailIndicator({ state: "configured", mode: "live" })).toBe("EMAIL_ENABLED");
    expect(mapEmailIndicator({ state: "disabled", mode: "disabled" })).toBe("EMAIL_DISABLED");
    expect(mapEmailIndicator({ state: "misconfigured", mode: "live" })).toBe("EMAIL_MISCONFIGURED");
  });

  it("maps sms indicators", () => {
    expect(mapSmsIndicator({ state: "configured", mode: "live" })).toBe("SMS_ENABLED");
    expect(mapSmsIndicator({ state: "disabled", mode: "disabled" })).toBe("SMS_DISABLED");
    expect(mapSmsIndicator({ state: "configured", mode: "mock" })).toBe("SMS_DISABLED");
    expect(mapSmsIndicator({ state: "misconfigured", mode: "live" })).toBe("SMS_MISCONFIGURED");
  });

  it("maps push indicators", () => {
    expect(mapPushIndicator({ mode: "active", configured: true })).toBe("PUSH_ENABLED");
    expect(mapPushIndicator({ mode: "mock", configured: false })).toBe("PUSH_NOOP");
    expect(mapPushIndicator({ mode: "disabled", configured: false })).toBe("PUSH_DISABLED");
  });

  it("redacts sensitive notification readiness fields", () => {
    expect(
      publicNotificationReadinessHasSensitiveFields({
        generatedAt: "2026-01-01T00:00:00.000Z",
        overallState: "disabled",
        email: {
          channel: "email",
          state: "disabled",
          mode: "disabled",
          indicator: "EMAIL_DISABLED",
          message: "ok",
          missingKeys: []
        },
        sms: {
          channel: "sms",
          state: "disabled",
          mode: "disabled",
          indicator: "SMS_DISABLED",
          message: "ok",
          missingKeys: []
        },
        push: {
          channel: "push",
          state: "disabled",
          mode: "disabled",
          indicator: "PUSH_DISABLED",
          message: "ok",
          missingKeys: []
        },
        uat: { uatEnabled: false, realSendsEnabled: false, allowlistCount: 0, message: "ok" }
      })
    ).toBe(false);

    expect(
      publicNotificationReadinessHasSensitiveFields({
        generatedAt: "2026-01-01T00:00:00.000Z",
        overallState: "disabled",
        email: { smtp_pass: "secret-value" }
      })
    ).toBe(true);
  });
});
