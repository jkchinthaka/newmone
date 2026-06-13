import {
  describeNotificationUatControls,
  isRecipientAllowlisted,
  maskEmailRecipient,
  maskPhoneRecipient,
  parseNotificationUatAllowlist,
  publicNotificationUatSendResultHasSensitiveFields
} from "../src/modules/notifications/notification-uat.mapper";

describe("notification provider safety helpers", () => {
  it("parses allowlist entries and validates recipients", () => {
    const allowlist = parseNotificationUatAllowlist("uat@example.com, +94771234567");
    expect(allowlist).toEqual(["uat@example.com", "+94771234567"]);
    expect(isRecipientAllowlisted("uat@example.com", allowlist, "email")).toBe(true);
    expect(isRecipientAllowlisted("other@example.com", allowlist, "email")).toBe(false);
    expect(isRecipientAllowlisted("+94771234567", allowlist, "sms")).toBe(true);
  });

  it("masks email and phone recipients safely", () => {
    expect(maskEmailRecipient("uat@example.com")).toBe("u***@example.com");
    expect(maskPhoneRecipient("+94771234567")).toBe("+947****567");
  });

  it("describes disabled UAT controls", () => {
    expect(
      describeNotificationUatControls({
        uatEnabled: false,
        realSendsEnabled: false,
        allowlist: []
      }).message
    ).toContain("disabled");
  });

  it("rejects public UAT results containing secret-like fields", () => {
    expect(
      publicNotificationUatSendResultHasSensitiveFields({
        channel: "email",
        status: "sent",
        provider: "smtp",
        templateKey: "critical_facility_issue",
        recipientMasked: "u***@example.com",
        messageId: "mail-1",
        sentAt: "2026-06-13T00:00:00.000Z",
        message: "ok",
        smtp_pass: "secret"
      })
    ).toBe(true);
  });
});
