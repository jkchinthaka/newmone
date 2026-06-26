import nodemailer from "nodemailer";

import { EmailDispatchService } from "../src/modules/notifications/email-dispatch.service";
import { NotificationReadinessService } from "../src/modules/notifications/notification-readiness.service";
import { NotificationTemplatesService } from "../src/modules/notifications/notification-templates.service";
import { NotificationUatService } from "../src/modules/notifications/notification-uat.service";
import {
  maskEmailRecipient,
  maskPhoneRecipient,
  publicNotificationUatSendResultHasSensitiveFields
} from "../src/modules/notifications/notification-uat.mapper";
import { SmsDispatchService } from "../src/modules/notifications/sms-dispatch.service";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn()
  }
}));

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

const baseUatConfig = {
  NOTIFICATION_UAT_ENABLED: true,
  NOTIFICATION_REAL_SENDS_ENABLED: true,
  NOTIFICATION_UAT_ALLOWED_RECIPIENTS: "uat@example.com,+94771234567",
  FRONTEND_URL: "https://app.example.com",
  EMAIL_MODE: "live",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: 587,
  SMTP_USER: "smtp-user",
  SMTP_PASS: "smtp-secret",
  SMTP_FROM: "MaintainPro Alerts <alerts@example.com>",
  SMS_MODE: "disabled"
};

const createUatService = (values: Record<string, unknown> = baseUatConfig) => {
  const config = configService(values);
  const emailDispatchService = new EmailDispatchService(config, {} as never);
  const smsDispatchService = new SmsDispatchService(config, {} as never);
  return new NotificationUatService(
    config,
    emailDispatchService,
    smsDispatchService,
    new NotificationTemplatesService()
  );
};

describe("NotificationUatService", () => {
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks sends when UAT is disabled", async () => {
    const service = createUatService({
      ...baseUatConfig,
      NOTIFICATION_UAT_ENABLED: false
    });

    const result = await service.sendEmailTest({
      recipient: "uat@example.com",
      templateKey: "critical_facility_issue"
    });

    expect(result.status).toBe("blocked");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("blocks sends when real sends are disabled", async () => {
    const service = createUatService({
      ...baseUatConfig,
      NOTIFICATION_REAL_SENDS_ENABLED: false
    });

    const result = await service.sendSmsTest({
      recipient: "+94771234567",
      templateKey: "overdue_sla_alert"
    });

    expect(result.status).toBe("blocked");
  });

  it("rejects non-allowlisted recipients", async () => {
    const service = createUatService();

    const result = await service.sendEmailTest({
      recipient: "other@example.com",
      templateKey: "invitation_created"
    });

    expect(result.status).toBe("rejected");
    expect(result.message).toContain("NOTIFICATION_UAT_ALLOWED_RECIPIENTS");
  });

  it("reports email not_configured when provider is disabled", async () => {
    const service = createUatService({
      ...baseUatConfig,
      EMAIL_MODE: "disabled"
    });

    const result = await service.sendEmailTest({
      recipient: "uat@example.com",
      templateKey: "work_order_from_issue"
    });

    expect(result.status).toBe("not_configured");
  });

  it("accepts allowlisted email with mocked provider and masks recipient in response", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "mail-uat-1" });
    createTransport.mockReturnValue({ sendMail });
    const service = createUatService();

    const result = await service.sendEmailTest({
      recipient: "uat@example.com",
      templateKey: "critical_facility_issue"
    });

    expect(result.status).toBe("sent");
    expect(result.recipientMasked).toBe(maskEmailRecipient("uat@example.com"));
    expect(result.messageId).toBe("mail-uat-1");
    expect(publicNotificationUatSendResultHasSensitiveFields(result)).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/smtp-secret|smtp-pass/i);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "uat@example.com",
        subject: expect.stringContaining("Critical")
      })
    );
  });

  it("reports SMS not_configured safely when SMS provider is disabled", async () => {
    const service = createUatService({
      ...baseUatConfig,
      SMS_MODE: "disabled"
    });

    const result = await service.sendSmsTest({
      recipient: "+94771234567",
      templateKey: "overdue_sla_alert"
    });

    expect(result.status).toBe("not_configured");
    expect(result.recipientMasked).toBe(maskPhoneRecipient("+94771234567"));
  });

  it("returns mock status for SMS mock mode without external calls", async () => {
    const service = createUatService({
      ...baseUatConfig,
      SMS_MODE: "mock"
    });
    const fetchSpy = jest.spyOn(global, "fetch");

    const result = await service.sendSmsTest({
      recipient: "+94771234567",
      templateKey: "critical_facility_issue"
    });

    expect(result.status).toBe("mock");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("NotificationReadinessService UAT controls", () => {
  it("includes staged UAT controls in readiness summary", () => {
    const service = new NotificationReadinessService(
      configService({
        EMAIL_MODE: "disabled",
        SMS_MODE: "disabled",
        PUSH_MODE: "disabled",
        NOTIFICATION_UAT_ENABLED: true,
        NOTIFICATION_REAL_SENDS_ENABLED: false,
        NOTIFICATION_UAT_ALLOWED_RECIPIENTS: "uat@example.com"
      }),
      new EmailDispatchService(configService({ EMAIL_MODE: "disabled" }), {} as never),
      new SmsDispatchService(configService({ SMS_MODE: "disabled" }), {} as never),
      {
        describeProviders: jest.fn(() => [
          { id: "noop", configured: false, mode: "disabled", description: "Push disabled" }
        ])
      } as never
    );

    const summary = service.getSummary();
    expect(summary.uat.uatEnabled).toBe(true);
    expect(summary.uat.realSendsEnabled).toBe(false);
    expect(summary.uat.allowlistCount).toBe(1);
  });
});
