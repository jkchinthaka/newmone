import {
  canAccessNotificationUat,
  formatNotificationUatResultSummary,
  notificationUatDoesNotPersistRecipient,
  notificationUatRecipientPlaceholder
} from "../../web/lib/notification-uat";

describe("notification UAT helpers", () => {
  it("allows only admin roles to access UAT controls", () => {
    expect(canAccessNotificationUat("SUPER_ADMIN")).toBe(true);
    expect(canAccessNotificationUat("ADMIN")).toBe(true);
    expect(canAccessNotificationUat("CLEANER")).toBe(false);
    expect(canAccessNotificationUat("VIEWER")).toBe(false);
  });

  it("formats safe UAT result summaries without secrets", () => {
    expect(
      formatNotificationUatResultSummary({
        channel: "email",
        status: "sent",
        provider: "smtp",
        templateKey: "critical_facility_issue",
        recipientMasked: "u***@example.com",
        messageId: "mail-1",
        sentAt: "2026-06-13T00:00:00.000Z",
        message: "UAT email accepted by SMTP provider."
      })
    ).toContain("EMAIL sent");
    expect(notificationUatRecipientPlaceholder("sms")).toContain("+");
    expect(notificationUatDoesNotPersistRecipient()).toBe(true);
  });
});
